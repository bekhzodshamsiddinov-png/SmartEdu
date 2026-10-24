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
    const v = {
      type,
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
      const [old] = await db.select().from(transactions).where(eq(transactions.id, id));
      if (!old) throw new Error('Yozuv topilmadi.');
      // Muallif o'zgarmaydi — kim kiritgani saqlanib qoladi
      await db.update(transactions).set({ ...v, createdById: old.createdById ?? u.id }).where(eq(transactions.id, id));
      const changed = old.amount !== amount || old.type !== type || old.date !== v.date || old.category !== v.category;
      await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Moliya yozuvi tahrirlandi', detail: changed ? `${label(old)} → ${label(v)}` : label(v) });
      if (old.amount !== amount) await notifyTelegram(`✏️ SmartEdu: moliya yozuvi summasi o'zgartirildi\n${label(old)} → ${money(amount)}\nKim: ${u.fullName}`);
    } else {
      await db.insert(transactions).values(v);
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
    await db.delete(transactions).where(eq(transactions.id, id));
    const d = `${old.type === 'kirim' ? 'Kirim' : 'Xarajat'} «${old.category}» ${money(old.amount)}, ${old.date}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Moliya yozuvi o'chirildi", detail: d });
    await notifyTelegram(`🗑 SmartEdu: moliya yozuvi o'chirildi\n${d}\nKim: ${u.fullName}`);
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
