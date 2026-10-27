'use server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cashboxes, salaryPayouts, staffAdjustments, transactions, users } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { boxInBranch, lockAndCheck, mainCashbox } from '@/lib/cashbox';
import { lockedBranch } from '@/lib/branch';
import { payroll } from '@/lib/payroll';
import { addMonths, thisMonth, today } from '@/lib/dates';
import { audit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';
import { money } from '@/lib/format';

const KINDS = ['bonus', 'jarima', 'avans'] as const;
const KIND_LABEL = { bonus: 'Bonus', jarima: 'Jarima', avans: 'Avans' } as const;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Faqat joriy oy va oxirgi 3 oy — kelajak oylarga oylik berib bo'lmaydi */
function checkMonth(m: string) {
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error("Oy noto'g'ri.");
  const now = thisMonth();
  if (m > now) throw new Error("Kelgusi oy uchun oylik yozib bo'lmaydi.");
  if (m < addMonths(now, -3)) throw new Error("Bu oy yopilgan — 3 oydan eski oylikni o'zgartirib bo'lmaydi.");
}

/**
 * Kimning oyligiga tegish mumkin: rahbar — hammaga; buxgalter — o'zidan boshqa,
 * filialga biriktirilgan bo'lsa faqat o'z filiali xodimlariga.
 */
async function assertStaffTarget(me: { id: number; role: string }, userId: number) {
  const [s] = await db.select({ id: users.id, name: users.fullName, b: users.branchId }).from(users).where(eq(users.id, userId));
  if (!s) throw new Error('Xodim topilmadi.');
  if (me.role !== 'rahbar') {
    if (s.id === me.id) throw new Error("O'z oyligingizni rahbar tasdiqlaydi.");
    const locked = await lockedBranch();
    if (locked && s.b && s.b !== locked) throw new Error('Bu xodim boshqa filialda ishlaydi.');
  }
  return s;
}

async function boxFrom(fd: FormData) {
  const id = int(fd, 'cashboxId');
  const box = id ? (await db.select().from(cashboxes).where(and(eq(cashboxes.id, id), eq(cashboxes.active, true))))[0] : await mainCashbox();
  if (!box) throw new Error('Kassa topilmadi.');
  if (!boxInBranch(box, await lockedBranch())) throw new Error('Bu kassa boshqa filialga tegishli.');
  return box;
}

const methodFrom = (fd: FormData) => (str(fd, 'method') === 'karta' ? 'karta' : str(fd, 'method') === 'bank' ? 'bank' : 'naqd');

/** Bir xodimning bir oyi bo'yicha amallar navbat bilan bajariladi (oylik berilayotganda tuzatish qo'shilmaydi) */
async function lockStaff(tx: Tx, userId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(7702, ${userId})`);
}

async function paidIn(tx: Tx, userId: number, month: string) {
  const [p] = await tx.select({ id: salaryPayouts.id }).from(salaryPayouts).where(and(eq(salaryPayouts.userId, userId), eq(salaryPayouts.month, month)));
  return !!p;
}

/** Bonus, jarima yoki avans. Avans kassadan chiqim sifatida ham yoziladi. */
export async function addAdjustment(userId: number, month: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    checkMonth(month);
    const kind = req(fd, 'kind', 'Turi') as (typeof KINDS)[number];
    if (!KINDS.includes(kind)) throw new Error("Turi noto'g'ri.");
    const amount = int(fd, 'amount');
    if (!amount || amount <= 0 || amount > 200_000_000) throw new Error("Summa noto'g'ri.");
    const staff = await assertStaffTarget(u, userId);
    const note = str(fd, 'note')?.slice(0, 200) ?? null;
    const box = kind === 'avans' ? await boxFrom(fd) : null;
    const method = methodFrom(fd);
    await db.transaction(async (tx) => {
      await lockStaff(tx, userId);
      if (await paidIn(tx, userId, month)) throw new Error("Bu oy oyligi allaqachon berilgan — o'zgartirib bo'lmaydi.");
      let transactionId: number | null = null;
      if (box) {
        await lockAndCheck(tx, box.id, method, amount);
        const [t] = await tx
          .insert(transactions)
          .values({ type: 'chiqim', category: 'Oylik', amount, date: today(), method, counterparty: staff.name, note: `Avans, ${month}${note ? `: ${note}` : ''}`, createdById: u.id, cashboxId: box.id, branchId: box.branchId })
          .returning({ id: transactions.id });
        transactionId = t.id;
      }
      await tx.insert(staffAdjustments).values({ userId, month, kind, amount, note, transactionId, createdById: u.id });
    });
    const d = `${staff.name}, ${month}: ${money(amount)}${note ? ` (${note})` : ''}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: `${KIND_LABEL[kind]} yozildi`, detail: d });
    if (kind !== 'jarima') await notifyTelegram(`💼 SmartEdu: ${KIND_LABEL[kind].toLowerCase()} yozildi\n${d}\nKim: ${u.fullName}`);
    return { message: `${KIND_LABEL[kind]} yozildi` };
  });
}

/**
 * Tuzatishni olib tashlash. Avans uchun kassadagi chiqim o'chirilmaydi —
 * pul qaytarilgani alohida kirim sifatida yoziladi (hisob izi saqlanadi).
 */
export async function deleteAdjustment(id: number) {
  return run(async () => {
    const u = await assertSection('finance');
    const [a] = await db.select().from(staffAdjustments).where(eq(staffAdjustments.id, id));
    if (!a) throw new Error('Yozuv topilmadi.');
    checkMonth(a.month);
    const staff = await assertStaffTarget(u, a.userId);
    await db.transaction(async (tx) => {
      await lockStaff(tx, a.userId);
      if (await paidIn(tx, a.userId, a.month)) throw new Error("Bu oy oyligi allaqachon berilgan — o'zgartirib bo'lmaydi.");
      if (a.transactionId) {
        const [t] = await tx.select().from(transactions).where(eq(transactions.id, a.transactionId));
        if (t)
          await tx.insert(transactions).values({ type: 'kirim', category: 'Boshqa daromad', amount: t.amount, date: today(), method: t.method, counterparty: staff.name, note: `Avans qaytarildi, ${a.month}`, createdById: u.id, cashboxId: t.cashboxId, branchId: t.branchId });
      }
      await tx.delete(staffAdjustments).where(eq(staffAdjustments.id, id));
    });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Oylik tuzatishi bekor qilindi", detail: `${staff.name}: ${a.kind} ${money(a.amount)}, ${a.month}` });
    return { message: a.kind === 'avans' ? 'Avans qaytarildi deb yozildi' : "O'chirildi" };
  });
}

/** Oylikni berish: hisob server tomonda qayta hisoblanadi, kassadan chiqim yoziladi, ikki marta berib bo'lmaydi */
export async function paySalary(userId: number, month: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    checkMonth(month);
    await assertStaffTarget(u, userId);
    const box = await boxFrom(fd);
    const method = methodFrom(fd);
    let paid = { name: '', total: 0 };
    await db.transaction(async (tx) => {
      await lockStaff(tx, userId);
      if (await paidIn(tx, userId, month)) throw new Error('Bu oy oyligi allaqachon berilgan.');
      // Qulfdan keyin hisoblaymiz — parallel tuzatishlar hisobga kiradi
      const row = (await payroll(month, await lockedBranch())).find((r) => r.userId === userId);
      if (!row) throw new Error('Xodim topilmadi.');
      if (row.total <= 0) throw new Error("Beriladigan summa yo'q.");
      await lockAndCheck(tx, box.id, method, row.total);
      const breakdown = JSON.stringify({ base: row.base, percent: row.percent, collected: row.collected, share: row.share, bonus: row.bonus, fine: row.fine, advance: row.advance });
      const [t] = await tx
        .insert(transactions)
        .values({ type: 'chiqim', category: 'Oylik', amount: row.total, date: today(), method, counterparty: row.name, note: `Oylik, ${month}`, createdById: u.id, cashboxId: box.id, branchId: box.branchId })
        .returning({ id: transactions.id });
      const r = await tx.insert(salaryPayouts).values({ userId, month, amount: row.total, breakdown, transactionId: t.id, paidById: u.id }).onConflictDoNothing().returning({ id: salaryPayouts.id });
      if (!r.length) throw new Error('Bu oy oyligi allaqachon berilgan.');
      paid = { name: row.name, total: row.total };
    });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Oylik berildi', detail: `${paid.name}, ${month}: ${money(paid.total)}` });
    await notifyTelegram(`💼 SmartEdu: oylik berildi\n${paid.name}, ${month}: ${money(paid.total)}\nKim: ${u.fullName}`);
    return { message: `${paid.name}: ${money(paid.total)} berildi` };
  });
}
