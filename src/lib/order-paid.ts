import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courseOrders, onlineCourses, learners } from '@/db/schema';
import { addDays, today } from './dates';
import { notifyTelegram } from './payments';
import { money } from './format';

/** Onlayn to'lov tasdiqlanganda buyurtmani to'langan qilish (Click / Payme) */
export async function markOrderPaid(orderId: number, provider: 'click' | 'payme', providerTx: string) {
  const [o] = await db.select().from(courseOrders).where(eq(courseOrders.id, orderId));
  if (!o || o.status === 'tolandi') return;
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, o.courseId));
  const d = today();
  await db
    .update(courseOrders)
    .set({ status: 'tolandi', paidAt: d, method: provider, provider, providerTx, accessUntil: c?.accessDays ? addDays(d, c.accessDays) : null })
    .where(eq(courseOrders.id, orderId));
  if (o.promoCode) await db.execute(sql`update promo_codes set used = used + 1 where code = ${o.promoCode}`);
  const [l] = await db.select({ n: learners.fullName, p: learners.phone }).from(learners).where(eq(learners.id, o.learnerId));
  await notifyTelegram(`To'lov tushdi (${provider === 'click' ? 'Click' : 'Payme'}): buyurtma #${orderId}\n${l?.n}, +${l?.p}\n${c?.title}\n${money(o.amount)}`);
}

export async function markOrderRefunded(orderId: number) {
  const [o] = await db.select().from(courseOrders).where(eq(courseOrders.id, orderId));
  if (!o || o.status !== 'tolandi') return;
  await db.update(courseOrders).set({ status: 'qaytarildi' }).where(eq(courseOrders.id, orderId));
  if (o.promoCode) await db.execute(sql`update promo_codes set used = greatest(0, used - 1) where code = ${o.promoCode}`);
}
