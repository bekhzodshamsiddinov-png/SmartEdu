'use server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { transactions, reconciliations } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { today } from '@/lib/dates';
import { RECON_ROWS } from '@/lib/finance';
import { branchForNew } from '@/lib/branch';

export async function saveTransaction(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    const amount = int(fd, 'amount');
    if (!amount || amount <= 0) throw new Error('Summani kiriting.');
    const type = req(fd, 'type', 'Turi') as 'kirim' | 'chiqim';
    const v = {
      type,
      category: req(fd, 'category', 'Toifa'),
      amount,
      date: str(fd, 'date') || today(),
      method: str(fd, 'method') || 'bank',
      counterparty: str(fd, 'counterparty'),
      document: str(fd, 'document'),
      note: str(fd, 'note'),
      createdById: u.id,
      branchId: int(fd, 'branchId') ?? (id ? undefined : await branchForNew()),
    };
    if (type === 'chiqim' && !v.document && v.method !== 'naqd') {
      // hujjat raqami tavsiya etiladi, lekin majburiy emas
    }
    if (id) await db.update(transactions).set(v).where(eq(transactions.id, id));
    else await db.insert(transactions).values(v);
    return { message: type === 'kirim' ? 'Kirim kiritildi' : 'Xarajat kiritildi' };
  });
}

export async function deleteTransaction(id: number) {
  return run(async () => {
    const u = await assertSection('finance');
    if (u.role !== 'rahbar') throw new Error("Yozuvni faqat rahbar o'chiradi.");
    await db.delete(transactions).where(eq(transactions.id, id));
    return { message: "Yozuv o'chirildi" };
  });
}

export async function saveReconciliation(month: string, fd: FormData) {
  return run(async () => {
    await assertSection('finance');
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
    return { message: 'Solishtirma saqlandi' };
  });
}
