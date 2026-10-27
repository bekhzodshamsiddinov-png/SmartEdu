'use server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { transactions, reconciliations } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { today } from '@/lib/dates';
import { RECON_ROWS } from '@/lib/finance';
import { assertBranch, resolveBranch } from '@/lib/branch';
import { audit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';
import { money } from '@/lib/format';
import { cashboxes } from '@/db/schema';
import { boxInBranch, lockAndCheck, mainCashbox } from '@/lib/cashbox';
import { lockedBranch } from '@/lib/branch';
import { and, sql } from 'drizzle-orm';

/** Oylik yoki avans bilan bog'langan yozuvni bu yerdan o'zgartirib bo'lmaydi — aks holda hisob buziladi */
async function assertNotPayroll(id: number) {
  const [r] = await db.execute<{ c: number }>(sql`
    select ((select count(*) from salary_payouts where transaction_id = ${id}) + (select count(*) from staff_adjustments where transaction_id = ${id}))::int c`);
  if (r?.c) throw new Error("Bu yozuv oylik yoki avans bilan bog'langan. Uni Moliya → Oylik bo'limidan boshqaring.");
}

export async function saveTransaction(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    await assertBranch('transaction', id);
    const amount = int(fd, 'amount');
    if (!amount || amount <= 0) throw new Error('Summani kiriting.');
    if (amount > 1_000_000_000) throw new Error('Summa juda katta — raqamni tekshiring.');
    const type = req(fd, 'type', 'Turi') as 'kirim' | 'chiqim';
    if (type !== 'kirim' && type !== 'chiqim') throw new Error("Turi noto'g'ri.");
    const date = str(fd, 'date') || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Sana noto'g'ri.");
    const [old] = id ? await db.select().from(transactions).where(eq(transactions.id, id)) : [];
    if (id && !old) throw new Error('Yozuv topilmadi.');
    if (id) await assertNotPayroll(id);
    // Tahrirlashda kassa maydoni bo'lmasa — eski kassa saqlanadi
    const boxId = int(fd, 'cashboxId') ?? old?.cashboxId ?? null;
    const box = boxId ? (await db.select().from(cashboxes).where(and(eq(cashboxes.id, boxId), eq(cashboxes.active, true))))[0] : await mainCashbox();
    if (!box) throw new Error('Kassa topilmadi.');
    if (!boxInBranch(box, await lockedBranch())) throw new Error('Bu kassa boshqa filialga tegishli.');
    const v = {
      type,
      cashboxId: box.id,
      category: req(fd, 'category', 'Toifa'),
      amount,
      date,
      method: str(fd, 'method') || 'bank',
      counterparty: str(fd, 'counterparty'),
      document: str(fd, 'document'),
      note: str(fd, 'note'),
      createdById: u.id,
      branchId: fd.has('branchId') || !id ? await resolveBranch(int(fd, 'branchId')) : undefined,
    };
    if (type === 'chiqim' && !v.document && v.method !== 'naqd') {
      // hujjat raqami tavsiya etiladi, lekin majburiy emas
    }
    const label = (t: { type: string; category: string; amount: number; date: string }) => `${t.type === 'kirim' ? 'Kirim' : 'Xarajat'} «${t.category}» ${money(t.amount)}, ${t.date}`;
    if (id) {
      // Muallif o'zgarmaydi — kim kiritgani saqlanib qoladi
      await db.transaction(async (tx) => {
        if (type === 'chiqim') {
          // Eski yozuv shu kassadan shu usulda chiqim bo'lsa, uning summasi qoldiqqa qaytarib hisoblanadi
          const credit = old.type === 'chiqim' && old.cashboxId === box.id && old.method === v.method ? old.amount : 0;
          await lockAndCheck(tx, box.id, v.method, amount, { credit });
        }
        await tx.update(transactions).set({ ...v, createdById: old.createdById ?? u.id }).where(eq(transactions.id, id));
      });
      const changed = old.amount !== amount || old.type !== type || old.date !== v.date || old.category !== v.category;
      await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Moliya yozuvi tahrirlandi', detail: changed ? `${label(old)} → ${label(v)}` : label(v) });
      if (old.amount !== amount) await notifyTelegram(`✏️ SmartEdu: moliya yozuvi summasi o'zgartirildi\n${label(old)} → ${money(amount)}\nKim: ${u.fullName}`);
    } else {
      await db.transaction(async (tx) => {
        if (type === 'chiqim') await lockAndCheck(tx, box.id, v.method, amount);
        await tx.insert(transactions).values(v);
      });
      await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Moliya yozuvi kiritildi', detail: label(v) });
    }
    return { message: type === 'kirim' ? 'Kirim kiritildi' : 'Xarajat kiritildi' };
  });
}

export async function deleteTransaction(id: number) {
  return run(async () => {
    const u = await assertSection('finance');
    if (u.role !== 'rahbar') throw new Error("Yozuvni faqat rahbar o'chiradi.");
    const [old] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!old) throw new Error('Yozuv topilmadi.');
    await assertNotPayroll(id);
    await db.delete(transactions).where(eq(transactions.id, id));
    const d = `${old.type === 'kirim' ? 'Kirim' : 'Xarajat'} «${old.category}» ${money(old.amount)}, ${old.date}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Moliya yozuvi o'chirildi", detail: d });
    await notifyTelegram(`🗑 SmartEdu: moliya yozuvi o'chirildi\n${d}\nKim: ${u.fullName}`);
    return { message: "Yozuv o'chirildi" };
  });
}

export async function saveReconciliation(month: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    if (u.branchId) throw new Error("Solishtirma butun kompaniya bo'yicha — uni rahbar bajaradi.");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Oy noto'g'ri.");
    const bank: Record<string, number> = {};
    const tax: Record<string, number> = {};
    for (const r of RECON_ROWS) {
      const b = int(fd, `bank_${r.key}`);
      const t = int(fd, `tax_${r.key}`);
      if (b !== null) bank[r.key] = b;
      if (t !== null) tax[r.key] = t;
    }
    await db
      .insert(reconciliations)
      .values({ month, bank, tax, note: str(fd, 'note') })
      .onConflictDoUpdate({ target: reconciliations.month, set: { bank, tax, note: str(fd, 'note'), updatedAt: new Date() } });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Solishtirma saqlandi', detail: month });
    return { message: 'Solishtirma saqlandi' };
  });
}
