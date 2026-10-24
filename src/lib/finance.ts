import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { today as todayFn, monthsBetween } from './dates';

export function monthsCharged(start: string, end: string | null, ref: string) {
  if (start > ref) return 0;
  const last = end && end < ref ? end : ref;
  if (last < start) return 0;
  return monthsBetween(start.slice(0, 7), last.slice(0, 7)) + 1;
}

export type Balance = { charged: number; paid: number; balance: number; monthlyFee: number; overdueMonths: number };

/** Har bir o'quvchining hisob-kitobi: hisoblangan summa, to'langan summa, balans */
export async function getBalances(ref = todayFn()): Promise<Map<number, Balance>> {
  const enr = await db.execute<{ student_id: number; monthly_fee: number; start_date: string; end_date: string | null; active: boolean }>(
    sql`select student_id, monthly_fee, start_date::text, end_date::text, active from enrollments`,
  );
  const pays = await db.execute<{ student_id: number; paid: string }>(
    sql`select student_id, sum(amount)::bigint as paid from payments group by student_id`,
  );
  const map = new Map<number, Balance>();
  for (const e of enr) {
    const b = map.get(e.student_id) ?? { charged: 0, paid: 0, balance: 0, monthlyFee: 0, overdueMonths: 0 };
    b.charged += e.monthly_fee * monthsCharged(e.start_date, e.end_date, ref);
    if (e.active && !e.end_date) b.monthlyFee += e.monthly_fee;
    map.set(e.student_id, b);
  }
  for (const p of pays) {
    const b = map.get(p.student_id) ?? { charged: 0, paid: 0, balance: 0, monthlyFee: 0, overdueMonths: 0 };
    b.paid = Number(p.paid);
    map.set(p.student_id, b);
  }
  for (const b of map.values()) {
    b.balance = b.paid - b.charged;
    b.overdueMonths = b.balance < 0 && b.monthlyFee > 0 ? Math.ceil(-b.balance / b.monthlyFee) : b.balance < 0 ? 1 : 0;
  }
  return map;
}

/** Ketma-ket oxirgi 2 darsga kelmagan o'quvchilar */
export async function absentStreakIds(): Promise<Set<number>> {
  const r = await db.execute<{ student_id: number }>(sql`
    select student_id from (
      select student_id, status, row_number() over (partition by student_id order by date desc) rn from attendance
    ) t where rn <= 2 group by student_id having count(*) = 2 and count(*) filter (where status = 'kelmadi') = 2`);
  return new Set(r.map((x) => x.student_id));
}

export const EXPENSE_CATEGORIES = ['Oylik', 'Ijara', 'Kommunal va internet', 'Marketing', 'Jihozlar', 'Soliqlar', 'Boshqa'] as const;
export const INCOME_CATEGORIES = ['Boshqa daromad', 'Grant', 'Xizmat (zakaz)', 'Investitsiya'] as const;

export const RECON_ROWS = [
  { key: 'kirim', label: 'Kirim' },
  { key: 'oylik', label: 'Oylik fondi' },
  { key: 'ijara', label: 'Ijara' },
  { key: 'kommunal', label: 'Kommunal va internet' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'soliq', label: "To'langan soliqlar" },
  { key: 'boshqa', label: 'Boshqa xarajatlar' },
] as const;

export const CATEGORY_TO_RECON: Record<string, string> = {
  Oylik: 'oylik',
  Ijara: 'ijara',
  'Kommunal va internet': 'kommunal',
  Marketing: 'marketing',
  Soliqlar: 'soliq',
  Jihozlar: 'boshqa',
  Boshqa: 'boshqa',
};
