/**
 * Payme Merchant API (JSON-RPC 2.0).
 * Kabinetda "Endpoint" sifatida: https://<sayt>/api/payme
 * Kerakli o'zgaruvchilar: PAYME_MERCHANT_ID, PAYME_KEY (test uchun PAYME_TEST=1 va test kaliti).
 * Hisob (account) maydoni: order_id
 */
import { NextResponse } from 'next/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courseOrders, paymeTransactions } from '@/db/schema';
import { paymeConfig } from '@/lib/payments';
import { markOrderPaid, markOrderRefunded } from '@/lib/order-paid';

export const dynamic = 'force-dynamic';

const TIMEOUT = 12 * 60 * 60 * 1000;

type Rpc = { id?: number | string; method?: string; params?: Record<string, unknown> };

const msg = (uz: string, ru: string, en = uz) => ({ uz, ru, en });
const E = {
  auth: { code: -32504, message: msg("Ruxsat yo'q", 'Недостаточно привилегий') },
  method: { code: -32601, message: msg('Metod topilmadi', 'Метод не найден') },
  parse: { code: -32700, message: msg("So'rovni o'qib bo'lmadi", 'Ошибка парсинга') },
  amount: { code: -31001, message: msg("Summa noto'g'ri", 'Неверная сумма') },
  txNotFound: { code: -31003, message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена') },
  cantDo: { code: -31008, message: msg("Amalni bajarib bo'lmaydi", 'Невозможно выполнить операцию') },
  cantCancel: { code: -31007, message: msg("Bekor qilib bo'lmaydi", 'Невозможно отменить транзакцию') },
  order: { code: -31050, message: msg('Buyurtma topilmadi', 'Заказ не найден'), data: 'order_id' },
  orderBusy: { code: -31051, message: msg("Buyurtma uchun to'lov jarayonda", 'Заказ ожидает оплаты'), data: 'order_id' },
  orderPaid: { code: -31052, message: msg("Buyurtma allaqachon to'langan", 'Заказ уже оплачен'), data: 'order_id' },
};

function reply(id: Rpc['id'] | null, body: { result?: unknown; error?: unknown }) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, ...body });
}

async function checkOrder(params: Record<string, unknown>) {
  const account = (params.account ?? {}) as Record<string, unknown>;
  const orderId = Number(account.order_id);
  const amount = Number(params.amount);
  if (!orderId) return { error: E.order };
  const [o] = await db.select().from(courseOrders).where(eq(courseOrders.id, orderId));
  if (!o) return { error: E.order };
  if (o.status === 'tolandi') return { error: E.orderPaid };
  if (o.status !== 'kutilmoqda') return { error: E.order };
  if (amount !== o.amount * 100) return { error: E.amount };
  return { order: o };
}

export async function POST(req: Request) {
  const cfg = paymeConfig();
  let body: Rpc = {};
  try {
    body = await req.json();
  } catch {
    return reply(null, { error: E.parse });
  }
  const auth = req.headers.get('authorization') || '';
  const expected = cfg ? 'Basic ' + Buffer.from(`Paycom:${cfg.key}`).toString('base64') : null;
  if (!cfg || auth !== expected) return reply(body.id, { error: E.auth });

  const p = body.params ?? {};
  const now = Date.now();

  switch (body.method) {
    case 'CheckPerformTransaction': {
      const r = await checkOrder(p);
      if (r.error) return reply(body.id, { error: r.error });
      return reply(body.id, { result: { allow: true } });
    }
    case 'CreateTransaction': {
      const pid = String(p.id);
      const [tx] = await db.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, pid));
      if (tx) {
        if (tx.state !== 1) return reply(body.id, { error: E.cantDo });
        if (now - tx.paymeTime > TIMEOUT) {
          await db.update(paymeTransactions).set({ state: -1, reason: 4, cancelTime: now }).where(eq(paymeTransactions.id, tx.id));
          return reply(body.id, { error: E.cantDo });
        }
        return reply(body.id, { result: { create_time: tx.createTime, transaction: String(tx.id), state: tx.state } });
      }
      const r = await checkOrder(p);
      if (r.error) return reply(body.id, { error: r.error });
      const [active] = await db.select({ id: paymeTransactions.id }).from(paymeTransactions).where(and(eq(paymeTransactions.orderId, r.order!.id), eq(paymeTransactions.state, 1)));
      if (active) return reply(body.id, { error: E.orderBusy });
      const [n] = await db
        .insert(paymeTransactions)
        .values({ paymeId: pid, orderId: r.order!.id, amount: Number(p.amount), state: 1, paymeTime: Number(p.time) || now, createTime: now })
        .returning();
      return reply(body.id, { result: { create_time: n.createTime, transaction: String(n.id), state: 1 } });
    }
    case 'PerformTransaction': {
      const [tx] = await db.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id)));
      if (!tx) return reply(body.id, { error: E.txNotFound });
      if (tx.state === 2) return reply(body.id, { result: { transaction: String(tx.id), perform_time: tx.performTime, state: 2 } });
      if (tx.state !== 1) return reply(body.id, { error: E.cantDo });
      if (now - tx.paymeTime > TIMEOUT) {
        await db.update(paymeTransactions).set({ state: -1, reason: 4, cancelTime: now }).where(eq(paymeTransactions.id, tx.id));
        return reply(body.id, { error: E.cantDo });
      }
      await db.update(paymeTransactions).set({ state: 2, performTime: now }).where(eq(paymeTransactions.id, tx.id));
      await markOrderPaid(tx.orderId, 'payme', String(p.id));
      return reply(body.id, { result: { transaction: String(tx.id), perform_time: now, state: 2 } });
    }
    case 'CancelTransaction': {
      const [tx] = await db.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id)));
      if (!tx) return reply(body.id, { error: E.txNotFound });
      const reason = Number(p.reason) || null;
      if (tx.state === 1) {
        await db.update(paymeTransactions).set({ state: -1, reason, cancelTime: now }).where(eq(paymeTransactions.id, tx.id));
        return reply(body.id, { result: { transaction: String(tx.id), cancel_time: now, state: -1 } });
      }
      if (tx.state === 2) {
        await db.update(paymeTransactions).set({ state: -2, reason, cancelTime: now }).where(eq(paymeTransactions.id, tx.id));
        await markOrderRefunded(tx.orderId);
        return reply(body.id, { result: { transaction: String(tx.id), cancel_time: now, state: -2 } });
      }
      return reply(body.id, { result: { transaction: String(tx.id), cancel_time: tx.cancelTime, state: tx.state } });
    }
    case 'CheckTransaction': {
      const [tx] = await db.select().from(paymeTransactions).where(eq(paymeTransactions.paymeId, String(p.id)));
      if (!tx) return reply(body.id, { error: E.txNotFound });
      return reply(body.id, {
        result: { create_time: tx.createTime, perform_time: tx.performTime, cancel_time: tx.cancelTime, transaction: String(tx.id), state: tx.state, reason: tx.reason },
      });
    }
    case 'GetStatement': {
      const from = Number(p.from);
      const to = Number(p.to);
      const rows = await db
        .select()
        .from(paymeTransactions)
        .where(and(gte(paymeTransactions.paymeTime, from), lte(paymeTransactions.paymeTime, to)))
        .orderBy(sql`${paymeTransactions.paymeTime}`);
      return reply(body.id, {
        result: {
          transactions: rows.map((t) => ({
            id: t.paymeId,
            time: t.paymeTime,
            amount: t.amount,
            account: { order_id: String(t.orderId) },
            create_time: t.createTime,
            perform_time: t.performTime,
            cancel_time: t.cancelTime,
            transaction: String(t.id),
            state: t.state,
            reason: t.reason,
          })),
        },
      });
    }
    default:
      return reply(body.id, { error: E.method });
  }
}
