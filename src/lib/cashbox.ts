import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cashboxes } from '@/db/schema';
import { money } from './format';

export const CASH_METHODS = ['naqd', 'karta', 'click', 'payme', 'bank'] as const;
export type CashMethod = (typeof CASH_METHODS)[number];

/** Asosiy kassa (yo'q bo'lsa yaratiladi) */
export async function mainCashbox() {
  const [m] = await db.select().from(cashboxes).where(eq(cashboxes.isMain, true)).orderBy(cashboxes.id).limit(1);
  if (m) return m;
  const [c] = await db.insert(cashboxes).values({ name: 'Asosiy kassa', isMain: true }).returning();
  return c;
}

/** Xodim pul qabul qilganda qaysi kassaga tushadi: o'z kassasi bo'lsa — o'shanga, bo'lmasa asosiy kassaga */
export async function cashboxForUser(userId: number) {
  const [own] = await db
    .select()
    .from(cashboxes)
    .where(and(eq(cashboxes.ownerId, userId), eq(cashboxes.active, true)))
    .orderBy(cashboxes.id)
    .limit(1);
  return own ?? (await mainCashbox());
}

export type CashboxBalance = { id: number; name: string; ownerId: number | null; owner: string | null; isMain: boolean; branchId: number | null; active: boolean; byMethod: Record<string, number>; total: number; pendingIn: number };

/**
 * Kassa qoldig'i usul bo'yicha:
 *   to'lovlar (bekor qilinmagan) + kirimlar − chiqimlar + qabul qilingan o'tkazmalar − yuborilgan o'tkazmalar
 * Yuborilgan, lekin hali tasdiqlanmagan o'tkazma yuboruvchi kassadan darhol ayriladi (ikki marta sarflab bo'lmasin).
 */
export async function cashboxBalances(): Promise<CashboxBalance[]> {
  const rows = await db.execute<{ id: number; name: string; owner_id: number | null; owner: string | null; is_main: boolean; branch_id: number | null; active: boolean }>(sql`
    select c.id, c.name, c.owner_id, u.full_name owner, c.is_main, c.branch_id, c.active
    from cashboxes c left join users u on u.id = c.owner_id order by c.is_main desc, c.active desc, c.name`);
  const flows = await db.execute<{ cashbox_id: number; method: string; s: string }>(sql`
    select cashbox_id, method, sum(s)::bigint s from (
      select coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)) cashbox_id, method::text method, amount s from payments where cancelled_at is null
      union all select coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)), method, case when type = 'kirim' then amount else -amount end from transactions
      union all select to_id, method, amount from cash_transfers where status = 'tasdiqlandi'
      union all select from_id, method, -amount from cash_transfers where status in ('tasdiqlandi', 'kutilmoqda')
    ) f group by 1, 2`);
  const pending = await db.execute<{ to_id: number; s: string }>(sql`select to_id, sum(amount)::bigint s from cash_transfers where status = 'kutilmoqda' group by 1`);
  const pend = new Map(pending.map((p) => [p.to_id, Number(p.s)]));
  const map = new Map<number, CashboxBalance>(
    rows.map((r) => [r.id, { id: r.id, name: r.name, ownerId: r.owner_id, owner: r.owner, isMain: r.is_main, branchId: r.branch_id, active: r.active, byMethod: {}, total: 0, pendingIn: pend.get(r.id) ?? 0 }]),
  );
  for (const f of flows) {
    const c = map.get(f.cashbox_id);
    if (!c) continue;
    c.byMethod[f.method] = (c.byMethod[f.method] ?? 0) + Number(f.s);
    c.total += Number(f.s);
  }
  return [...map.values()];
}

export async function cashboxBalance(id: number, method: string) {
  const all = await cashboxBalances();
  return all.find((c) => c.id === id)?.byMethod[method] ?? 0;
}

type Exec = Pick<typeof db, 'execute'>;

/** Bitta kassaning bitta usul bo'yicha qoldig'i (tranzaksiya ichida ham ishlaydi) */
export async function boxMethodBalance(exec: Exec, boxId: number, method: string) {
  const [b] = await exec.execute<{ s: string }>(sql`
    select coalesce(sum(s), 0)::bigint s from (
      select amount s from payments where cancelled_at is null and method::text = ${method}
        and coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)) = ${boxId}
      union all select case when type = 'kirim' then amount else -amount end from transactions where method = ${method}
        and coalesce(cashbox_id, (select id from cashboxes where is_main order by id limit 1)) = ${boxId}
      union all select amount from cash_transfers where to_id = ${boxId} and method = ${method} and status = 'tasdiqlandi'
      union all select -amount from cash_transfers where from_id = ${boxId} and method = ${method} and status in ('tasdiqlandi','kutilmoqda')
    ) f`);
  return Number(b.s);
}

/**
 * Kassadan pul chiqishidan oldin: kassani qulflab (parallel so'rovlar navbatga turadi), qoldiqni tekshiradi.
 * Naqd pul — jismoniy pul, u manfiyga tushmasligi shart. Bank/karta hisoblari tarixi to'liq bo'lmasligi mumkin,
 * shuning uchun ular faqat qulflanadi. `force` — o'tkazmalar uchun barcha usullarda tekshirish.
 */
export async function lockAndCheck(tx: Exec, boxId: number, method: string, amount: number, opts: { all?: boolean; credit?: number } = {}) {
  await tx.execute(sql`select pg_advisory_xact_lock(7701, ${boxId})`);
  if (method !== 'naqd' && !opts.all) return;
  const bal = (await boxMethodBalance(tx, boxId, method)) + (opts.credit ?? 0);
  if (bal < amount) throw new Error(`Kassada yetarli mablag' yo'q: ${money(Math.max(0, bal))}.`);
}

/** Filialga biriktirilgan xodim faqat o'z filiali (yoki filialsiz) kassasi bilan ishlaydi */
export function boxInBranch(box: { branchId: number | null }, locked: number | null) {
  return !locked || !box.branchId || box.branchId === locked;
}
