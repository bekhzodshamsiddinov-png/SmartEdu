'use server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cashboxes, salaryPayouts, staffAdjustments, transactions, users } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { mainCashbox } from '@/lib/cashbox';
import { payroll } from '@/lib/payroll';
import { today } from '@/lib/dates';
import { audit } from '@/lib/security';
import { money } from '@/lib/format';

const KINDS = ['bonus', 'jarima', 'avans'] as const;
const KIND_LABEL = { bonus: 'Bonus', jarima: 'Jarima', avans: 'Avans' } as const;

function checkMonth(m: string) {
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error("Oy noto'g'ri.");
}

async function boxFrom(fd: FormData) {
  const id = int(fd, 'cashboxId');
  const box = id ? (await db.select().from(cashboxes).where(and(eq(cashboxes.id, id), eq(cashboxes.active, true))))[0] : await mainCashbox();
  if (!box) throw new Error('Kassa topilmadi.');
  return box;
}

async function ensureNotPaid(userId: number, month: string) {
  const [p] = await db.select({ id: salaryPayouts.id }).from(salaryPayouts).where(and(eq(salaryPayouts.userId, userId), eq(salaryPayouts.month, month)));
  if (p) throw new Error("Bu oy oyligi allaqachon berilgan — o'zgartirib bo'lmaydi.");
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
    const [staff] = await db.select({ id: users.id, name: users.fullName }).from(users).where(eq(users.id, userId));
    if (!staff) throw new Error('Xodim topilmadi.');
    await ensureNotPaid(userId, month);
    const note = str(fd, 'note')?.slice(0, 200) ?? null;
    await db.transaction(async (tx) => {
      let transactionId: number | null = null;
      if (kind === 'avans') {
        const box = await boxFrom(fd);
        const method = str(fd, 'method') === 'karta' ? 'karta' : str(fd, 'method') === 'bank' ? 'bank' : 'naqd';
        const [t] = await tx
          .insert(transactions)
          .values({ type: 'chiqim', category: 'Oylik', amount, date: today(), method, counterparty: staff.name, note: `Avans, ${month}${note ? `: ${note}` : ''}`, createdById: u.id, cashboxId: box.id, branchId: box.branchId })
          .returning({ id: transactions.id });
        transactionId = t.id;
      }
      await tx.insert(staffAdjustments).values({ userId, month, kind, amount, note, transactionId, createdById: u.id });
    });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: `${KIND_LABEL[kind]} yozildi`, detail: `${staff.name}, ${month}: ${money(amount)}` });
    return { message: `${KIND_LABEL[kind]} yozildi` };
  });
}

export async function deleteAdjustment(id: number) {
  return run(async () => {
    const u = await assertSection('finance');
    const [a] = await db.select().from(staffAdjustments).where(eq(staffAdjustments.id, id));
    if (!a) throw new Error('Yozuv topilmadi.');
    await ensureNotPaid(a.userId, a.month);
    await db.transaction(async (tx) => {
      await tx.delete(staffAdjustments).where(eq(staffAdjustments.id, id));
      if (a.transactionId) await tx.delete(transactions).where(eq(transactions.id, a.transactionId));
    });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Oylik tuzatishi o'chirildi", detail: `${a.kind} ${money(a.amount)}, ${a.month}` });
    return { message: "O'chirildi" };
  });
}

/** Oylikni berish: hisob server tomonda qayta hisoblanadi, kassadan chiqim yoziladi, ikki marta berib bo'lmaydi */
export async function paySalary(userId: number, month: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    checkMonth(month);
    const row = (await payroll(month)).find((r) => r.userId === userId);
    if (!row) throw new Error('Xodim topilmadi.');
    if (row.paid) throw new Error('Bu oy oyligi allaqachon berilgan.');
    if (row.total <= 0) throw new Error("Beriladigan summa yo'q.");
    const box = await boxFrom(fd);
    const method = str(fd, 'method') === 'karta' ? 'karta' : str(fd, 'method') === 'bank' ? 'bank' : 'naqd';
    const breakdown = JSON.stringify({ base: row.base, percent: row.percent, collected: row.collected, share: row.share, bonus: row.bonus, fine: row.fine, advance: row.advance });
    await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(transactions)
        .values({ type: 'chiqim', category: 'Oylik', amount: row.total, date: today(), method, counterparty: row.name, note: `Oylik, ${month}`, createdById: u.id, cashboxId: box.id, branchId: box.branchId })
        .returning({ id: transactions.id });
      const r = await tx.insert(salaryPayouts).values({ userId, month, amount: row.total, breakdown, transactionId: t.id, paidById: u.id }).onConflictDoNothing().returning({ id: salaryPayouts.id });
      if (!r.length) throw new Error('Bu oy oyligi allaqachon berilgan.');
    });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Oylik berildi', detail: `${row.name}, ${month}: ${money(row.total)}` });
    return { message: `${row.name}: ${money(row.total)} berildi` };
  });
}
