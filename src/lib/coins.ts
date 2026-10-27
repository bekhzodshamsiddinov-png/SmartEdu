import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getSettings } from './settings';

/** Darsga kelgan/kechikkan o'quvchiga coin; holat o'zgarsa coin qaytariladi (takrorlanmaydi) */
export async function syncAttendanceCoins(groupId: number, date: string) {
  const s = await getSettings();
  if (!s.coinsPerLesson) return;
  await db.execute(sql`
    insert into coins (student_id, amount, reason, auto_key)
    select a.student_id, ${s.coinsPerLesson}, 'Darsga keldi', 'att:' || a.id
    from attendance a where a.group_id = ${groupId} and a.date = ${date} and a.status in ('keldi','kechikdi')
    on conflict do nothing`);
  await db.execute(sql`
    delete from coins c using attendance a
    where c.auto_key = 'att:' || a.id and a.group_id = ${groupId} and a.date = ${date} and a.status not in ('keldi','kechikdi')`);
}

/** O'z vaqtida (to'lov kunigacha) to'lab, qarzi qolmagan o'quvchiga oyiga bir marta coin */
export async function onTimePaymentCoin(studentId: number, paidAt: string, balanceAfter: number) {
  const s = await getSettings();
  if (!s.coinsOnTimePay || balanceAfter < 0 || Number(paidAt.slice(8)) > s.paymentDueDay) return;
  await db.execute(sql`
    insert into coins (student_id, amount, reason, auto_key) values (${studentId}, ${s.coinsOnTimePay}, 'O''z vaqtida to''lov', ${`pay:${studentId}:${paidAt.slice(0, 7)}`})
    on conflict do nothing`);
}

export async function coinBalance(studentId: number) {
  const [r] = await db.execute<{ s: number }>(sql`select coalesce(sum(amount), 0)::int s from coins where student_id = ${studentId}`);
  return r?.s ?? 0;
}
