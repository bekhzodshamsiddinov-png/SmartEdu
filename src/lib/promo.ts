import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { today } from './dates';

/** db yoki tranzaksiya — ikkalasida ham ishlaydi */
type Exec = Pick<typeof db, 'execute'>;

/**
 * Promokod limitini atomar band qilish: faqat faol, muddati o'tmagan, limiti qolgan va
 * shu kursga mos kod bo'lsa. Bir vaqtdagi parallel so'rovlar limitdan oshira olmaydi.
 */
export async function reservePromo(code: string, courseId: number, exec: Exec = db) {
  const r = await exec.execute<{ id: number }>(sql`
    update promo_codes set used = used + 1
    where code = ${code} and active
      and (max_uses is null or used < max_uses)
      and (valid_until is null or valid_until >= ${today()})
      and (course_id is null or course_id = ${courseId})
    returning id`);
  return r.length > 0;
}

/** Buyurtmaga band qilingan promokodni bo'shatish (takroriy chaqiruvga chidamli) */
export async function releaseOrderPromo(orderId: number, exec: Exec = db) {
  const r = await exec.execute<{ promo_code: string | null }>(sql`
    update course_orders set promo_reserved = false where id = ${orderId} and promo_reserved returning promo_code`);
  const code = r[0]?.promo_code;
  if (code) await exec.execute(sql`update promo_codes set used = greatest(0, used - 1) where code = ${code}`);
}

/**
 * Saytdan ochilib, 72 soat ichida to'lanmagan buyurtmalarni bekor qilish (band promokodlar bo'shaydi).
 * "To'ladim" bosilganlar 7 kun kutiladi; Payme to'lovi jarayonda bo'lsa tegilmaydi.
 */
export async function expireStaleOrders() {
  const rows = await db.execute<{ id: number }>(sql`
    update course_orders o set status = 'bekor', note = coalesce(note, '') || ' [to''lanmadi, muddati o''tdi]'
    where o.status = 'kutilmoqda' and o.provider = 'sayt'
      and o.created_at < now() - interval '72 hours'
      -- "To'ladim" bosilgan buyurtma administrator tekshirishi uchun 7 kun saqlanadi
      and (coalesce(o.note, '') not like 'O''quvchi to''laganini bildirdi%' or o.created_at < now() - interval '7 days')
      and not exists (select 1 from payme_transactions t where t.order_id = o.id and t.state = 1)
    returning o.id`);
  for (const r of rows) await releaseOrderPromo(r.id);
}
