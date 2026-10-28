import { ipAllowed, requestIp } from '@/lib/ip-allow';
/**
 * Click SHOP API. Kabinetda Prepare URL ham, Complete URL ham: https://<sayt>/api/click
 * Kerakli o'zgaruvchilar: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY
 * merchant_trans_id = buyurtma raqami
 */
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { courseOrders, paymeTransactions } from '@/db/schema';
import { clickConfig } from '@/lib/payments';
import { markOrderPaid } from '@/lib/order-paid';
import { auditExternal, safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

export async function POST(req: Request) {
  // Ixtiyoriy: faqat Click serverlari IP manzillaridan (CLICK_ALLOWED_IPS)
  if (!ipAllowed(requestIp(req), process.env.CLICK_ALLOWED_IPS)) return new Response('Forbidden', { status: 403 });
  const cfg = clickConfig();
  const fd = await req.formData().catch(() => null);
  const f = (k: string) => (fd?.get(k) ?? '').toString();
  const clickTransId = f('click_trans_id');
  const merchantTransId = f('merchant_trans_id');
  const action = f('action');
  const base = { click_trans_id: clickTransId, merchant_trans_id: merchantTransId };
  const fail = (error: number, note: string) => NextResponse.json({ ...base, error, error_note: note });

  if (!cfg || !fd) return fail(-8, 'Error in request from click');
  if (f('service_id') !== cfg.serviceId) return fail(-8, 'Error in request from click');

  const prepareId = f('merchant_prepare_id');
  const signSource = clickTransId + f('service_id') + cfg.secret + merchantTransId + (action === '1' ? prepareId : '') + f('amount') + action + f('sign_time');
  if (!safeEqual(md5(signSource), f('sign_string'))) {
    await auditExternal('Click: imzo xato', `buyurtma ${merchantTransId.slice(0, 20)}`);
    return fail(-1, 'SIGN CHECK FAILED!');
  }
  if (action !== '0' && action !== '1') return fail(-3, 'Action not found');

  const orderId = Number(merchantTransId);
  const [o] = orderId ? await db.select().from(courseOrders).where(eq(courseOrders.id, orderId)) : [];
  if (!o) return fail(-5, 'User does not exist');
  const amt = Number(f('amount'));
  if (!Number.isFinite(amt) || Math.abs(amt - o.amount) > 0.01) return fail(-2, 'Incorrect parameter amount');

  if (action === '0') {
    if (o.status === 'tolandi') return fail(-4, 'Already paid');
    if (o.status !== 'kutilmoqda') return fail(-9, 'Transaction cancelled');
    // Shu buyurtma uchun Payme to'lovi jarayonda — ikki marta to'lashning oldini olamiz
    const [busy] = await db.select({ id: paymeTransactions.id }).from(paymeTransactions).where(and(eq(paymeTransactions.orderId, o.id), eq(paymeTransactions.state, 1)));
    if (busy) return fail(-8, 'Order payment in progress');
    return NextResponse.json({ ...base, merchant_prepare_id: o.id, error: 0, error_note: 'Success' });
  }

  // action = 1 (complete)
  if (Number(prepareId) !== o.id) return fail(-6, 'Transaction does not exist');
  // Click shu to'lovni qayta yuborsa (retry) — xuddi o'sha javobni qaytaramiz
  if (o.status === 'tolandi' && o.provider === 'click' && o.providerTx === clickTransId) {
    return NextResponse.json({ ...base, merchant_confirm_id: o.id, error: 0, error_note: 'Success' });
  }
  if (o.status === 'tolandi') return fail(-4, 'Already paid');
  if (o.status !== 'kutilmoqda') return fail(-9, 'Transaction cancelled');
  if (Number(f('error')) < 0) {
    return NextResponse.json({ ...base, merchant_confirm_id: o.id, error: -9, error_note: 'Transaction cancelled' });
  }
  if (!(await markOrderPaid(o.id, 'click', clickTransId, Math.round(amt)))) return fail(-4, 'Already paid');
  return NextResponse.json({ ...base, merchant_confirm_id: o.id, error: 0, error_note: 'Success' });
}
