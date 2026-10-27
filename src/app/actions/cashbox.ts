'use server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cashboxes, cashTransfers, users } from '@/db/schema';
import { assertSection, getCurrentUser } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { CASH_METHODS } from '@/lib/cashbox';
import { audit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';
import { money } from '@/lib/format';

const isFinance = (role: string) => role === 'rahbar' || role === 'bugalter';

/** Kassa ochish yoki tahrirlash — faqat rahbar */
export async function saveCashbox(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('finance');
    if (u.role !== 'rahbar') throw new Error('Kassalarni rahbar boshqaradi.');
    const name = req(fd, 'name', 'Kassa nomi').slice(0, 60);
    const ownerId = int(fd, 'ownerId');
    if (ownerId) {
      const [o] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, ownerId), eq(users.active, true)));
      if (!o) throw new Error('Xodim topilmadi.');
      const [busy] = await db.select({ id: cashboxes.id }).from(cashboxes).where(and(eq(cashboxes.ownerId, ownerId), eq(cashboxes.active, true)));
      if (busy && busy.id !== id) throw new Error('Bu xodimda allaqachon kassa bor.');
    }
    const v = { name, ownerId: ownerId ?? null, branchId: int(fd, 'branchId') ?? null };
    if (id) await db.update(cashboxes).set(v).where(eq(cashboxes.id, id));
    else await db.insert(cashboxes).values(v);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: id ? 'Kassa tahrirlandi' : 'Kassa ochildi', detail: name });
    return { message: id ? 'Kassa yangilandi' : 'Kassa ochildi' };
  });
}

export async function toggleCashbox(id: number) {
  return run(async () => {
    const u = await assertSection('finance');
    if (u.role !== 'rahbar') throw new Error('Kassalarni rahbar boshqaradi.');
    const [c] = await db.select().from(cashboxes).where(eq(cashboxes.id, id));
    if (!c) throw new Error('Kassa topilmadi.');
    if (c.isMain) throw new Error("Asosiy kassani yopib bo'lmaydi.");
    await db.update(cashboxes).set({ active: !c.active }).where(eq(cashboxes.id, id));
    return { message: c.active ? 'Kassa yopildi' : 'Kassa qayta ochildi' };
  });
}

/**
 * Kassadan kassaga o'tkazma. Yuboruvchi — kassa egasi yoki rahbar/buxgalter.
 * Qoldiqdan ortiq yuborib bo'lmaydi; bir vaqtdagi ikki so'rov kassani manfiyga tushira olmaydi (qulf).
 * Rahbar yuborsa — darhol tasdiqlanadi, aks holda qabul qiluvchi tasdiqlaydi.
 */
export async function createTransfer(fd: FormData) {
  return run(async () => {
    const u = await getCurrentUser();
    if (!u) throw new Error('Tizimga qayta kiring.');
    const fromId = int(fd, 'fromId');
    const toId = int(fd, 'toId');
    const amount = int(fd, 'amount');
    const method = str(fd, 'method') || 'naqd';
    if (!fromId || !toId || fromId === toId) throw new Error('Kassalarni tanlang.');
    if (!amount || amount <= 0 || amount > 1_000_000_000) throw new Error("Summa noto'g'ri.");
    if (!(CASH_METHODS as readonly string[]).includes(method)) throw new Error("To'lov usuli noto'g'ri.");
    const boxes = await db.select().from(cashboxes).where(sql`${cashboxes.id} in (${fromId}, ${toId})`);
    const from = boxes.find((b) => b.id === fromId);
    const to = boxes.find((b) => b.id === toId);
    if (!from || !to || !from.active || !to.active) throw new Error('Kassa topilmadi.');
    if (!isFinance(u.role) && from.ownerId !== u.id) throw new Error("Faqat o'z kassangizdan pul o'tkaza olasiz.");
    const auto = u.role === 'rahbar';
    const note = str(fd, 'note')?.slice(0, 200) ?? null;
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7701, ${fromId})`);
      const [b] = await tx.execute<{ s: string }>(sql`
        select coalesce(sum(s), 0)::bigint s from (
          select amount s from payments where cancelled_at is null and method::text = ${method}
            and coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)) = ${fromId}
          union all select case when type = 'kirim' then amount else -amount end from transactions where method = ${method}
            and coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)) = ${fromId}
          union all select amount from cash_transfers where to_id = ${fromId} and method = ${method} and status = 'tasdiqlandi'
          union all select -amount from cash_transfers where from_id = ${fromId} and method = ${method} and status in ('tasdiqlandi','kutilmoqda')
        ) f`);
      if (Number(b.s) < amount) throw new Error(`Kassada yetarli mablag' yo'q: ${money(Number(b.s))}.`);
      await tx.insert(cashTransfers).values({
        fromId,
        toId,
        method,
        amount,
        note,
        createdById: u.id,
        status: auto ? 'tasdiqlandi' : 'kutilmoqda',
        confirmedById: auto ? u.id : null,
        confirmedAt: auto ? new Date() : null,
      });
    });
    const d = `${from.name} → ${to.name}: ${money(amount)} (${method})`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Kassalar o'rtasida o'tkazma", detail: d });
    return { message: auto ? "O'tkazildi" : "Yuborildi — qabul qiluvchi tasdiqlashi kerak" };
  });
}

/** O'tkazmani tasdiqlash yoki rad etish: qabul qiluvchi kassa egasi yoki rahbar/buxgalter; o'zi yuborganini o'zi tasdiqlay olmaydi */
export async function decideTransfer(id: number, accept: boolean) {
  return run(async () => {
    const u = await getCurrentUser();
    if (!u) throw new Error('Tizimga qayta kiring.');
    const [t] = await db.select().from(cashTransfers).where(eq(cashTransfers.id, id));
    if (!t) throw new Error("O'tkazma topilmadi.");
    const [to] = await db.select().from(cashboxes).where(eq(cashboxes.id, t.toId));
    const [from] = await db.select().from(cashboxes).where(eq(cashboxes.id, t.fromId));
    const mayDecide = u.role === 'rahbar' || (to?.ownerId ? to.ownerId === u.id : u.role === 'bugalter');
    if (!mayDecide) throw new Error("Bu o'tkazmani qabul qiluvchi tasdiqlaydi.");
    if (accept && t.createdById === u.id && u.role !== 'rahbar') throw new Error("O'zingiz yuborgan o'tkazmani o'zingiz tasdiqlay olmaysiz.");
    const r = await db
      .update(cashTransfers)
      .set({ status: accept ? 'tasdiqlandi' : 'rad_etildi', confirmedById: u.id, confirmedAt: new Date() })
      .where(and(eq(cashTransfers.id, id), eq(cashTransfers.status, 'kutilmoqda')))
      .returning({ id: cashTransfers.id });
    if (!r.length) throw new Error("O'tkazma allaqachon ko'rib chiqilgan.");
    const d = `${from?.name} → ${to?.name}: ${money(t.amount)} (${t.method})`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: accept ? "O'tkazma tasdiqlandi" : "O'tkazma rad etildi", detail: d });
    if (!accept) await notifyTelegram(`↩️ SmartEdu: kassa o'tkazmasi rad etildi\n${d}\nKim: ${u.fullName}`);
    return { message: accept ? 'Qabul qilindi' : 'Rad etildi' };
  });
}
