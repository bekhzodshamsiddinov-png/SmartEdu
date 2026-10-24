import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courseOrders, onlineCourses, learners } from '@/db/schema';
import { addDays, today } from './dates';
import { notifyTelegram } from './payments';
import { money } from './format';
import { releaseOrderPromo } from './promo';

type Exec = Pick<typeof db, 'execute' | 'select'>;

/**
 * Onlayn to'lov tasdiqlanganda buyurtmani to'langan qilish (Click / Payme).
 * Atomar: faqat "kutilmoqda" holatidagi buyurtma o'zgaradi, shuning uchun ikki parallel
 * tasdiq (yoki Click + Payme) buyurtmani ikki marta to'langan qila olmaydi.
 * true — shu chaqiruv buyurtmani to'langan qildi.
 */
export async function markOrderPaid(orderId: number, provider: 'click' | 'payme', providerTx: string, exec: Exec = db) {
  const [c] = await exec
    .select({ accessDays: onlineCourses.accessDays, title: onlineCourses.title })
    .from(courseOrders)
    .innerJoin(onlineCourses, eq(onlineCourses.id, courseOrders.courseId))
    .where(eq(courseOrders.id, orderId));
  const d = today();
  const access = c?.accessDays ? addDays(d, c.accessDays) : null;
  const rows = await exec.execute<{ id: number; learner_id: number; amount: number; promo_code: string | null; promo_reserved: boolean }>(sql`
    update course_orders
    set status = 'tolandi', paid_at = ${d}, method = ${provider}, provider = ${provider}, provider_tx = ${providerTx}, access_until = ${access}
    where id = ${orderId} and status = 'kutilmoqda'
    returning id, learner_id, amount, promo_code, promo_reserved`);
  const o = rows[0];
  if (!o) return false;
  // Pul olingan: band qilinmagan promokod bo'lsa ham hisobga qo'shamiz
  if (o.promo_code && !o.promo_reserved) {
    await exec.execute(sql`update promo_codes set used = used + 1 where code = ${o.promo_code}`);
    await exec.execute(sql`update course_orders set promo_reserved = true where id = ${orderId}`);
  }
  const [l] = await exec.select({ n: learners.fullName, p: learners.phone }).from(learners).where(eq(learners.id, o.learner_id));
  await notifyTelegram(`To'lov tushdi (${provider === 'click' ? 'Click' : 'Payme'}): buyurtma #${orderId}\n${l?.n}, +${l?.p}\n${c?.title}\n${money(o.amount)}`);
  return true;
}

/** Faqat shu provayder tranzaksiyasi bilan to'langan buyurtmani qaytarish (boshqa to'lovga tegmaydi) */
export async function markOrderRefunded(orderId: number, provider: 'click' | 'payme', providerTx: string, exec: Exec = db) {
  const rows = await exec.execute<{ id: number }>(sql`
    update course_orders set status = 'qaytarildi'
    where id = ${orderId} and status = 'tolandi' and provider = ${provider} and provider_tx = ${providerTx}
    returning id`);
  if (rows.length) await releaseOrderPromo(orderId, exec);
}
