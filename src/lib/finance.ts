import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { today as todayFn, monthsBetween } from './dates';
import { ensureMonthlyCharges } from './billing';

export function monthsCharged(start: string, end: string | null, ref: string) {
  if (start > ref) return 0;
  const last = end && end < ref ? end : ref;
  if (last < start) return 0;
  return monthsBetween(start.slice(0, 7), last.slice(0, 7)) + 1;
}

export type Balance = { charged: number; paid: number; balance: number; monthlyFee: number; overdueMonths: number };

/**
 * Har bir o'quvchining hisobi hisob daftaridan: yechimlar (charges) va bekor qilinmagan to'lovlar.
 * Balans musbat — oldindan to'langan ("haqdor"), manfiy — qarz.
 */
export async function getBalances(ref = todayFn()): Promise<Map<number, Balance>> {
  await ensureMonthlyCharges();
  const [ch, pays, fees] = await Promise.all([
    db.execute<{ student_id: number; s: string }>(sql`select student_id, sum(amount)::bigint s from charges where date <= ${ref} group by 1`),
    db.execute<{ student_id: number; s: string }>(sql`select student_id, sum(amount)::bigint s from payments where cancelled_at is null and paid_at <= ${ref} group by 1`),
    db.execute<{ student_id: number; s: string }>(sql`select student_id, sum(monthly_fee)::bigint s from enrollments where active and end_date is null group by 1`),
  ]);
  const map = new Map<number, Balance>();
  const get = (id: number) => {
    let b = map.get(id);
    if (!b) map.set(id, (b = { charged: 0, paid: 0, balance: 0, monthlyFee: 0, overdueMonths: 0 }));
    return b;
  };
  for (const r of ch) get(r.student_id).charged = Number(r.s);
  for (const r of pays) get(r.student_id).paid = Number(r.s);
  for (const r of fees) get(r.student_id).monthlyFee = Number(r.s);
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
export const INCOME_CATEGORIES = ['Boshqa daromad', 'Grant', 'Xizmat (zakaz)', 'Investitsiya', "Boshlang'ich qoldiq"] as const;

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

/** Bitta o'quvchining joriy balansi (to'lovlar − yechimlar) */
export async function studentBalance(studentId: number, ref = todayFn()) {
  await ensureMonthlyCharges();
  const [r] = await db.execute<{ p: string; c: string }>(sql`
    select (select coalesce(sum(amount), 0) from payments where student_id = ${studentId} and cancelled_at is null and paid_at <= ${ref})::bigint p,
           (select coalesce(sum(amount), 0) from charges where student_id = ${studentId} and date <= ${ref})::bigint c`);
  return Number(r.p) - Number(r.c);
}
