import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { monthEnd, monthStart } from './dates';

export type PayrollRow = {
  userId: number;
  name: string;
  role: string;
  base: number;
  percent: number;
  /** O'qituvchi guruhlaridagi o'quvchilardan shu oy haqiqatda tushgan pul */
  collected: number;
  share: number;
  bonus: number;
  fine: number;
  advance: number;
  total: number;
  paid: { id: number; amount: number; at: string } | null;
  adjustments: { id: number; kind: string; amount: number; note: string | null; date: string }[];
};

/**
 * Oylik hisob-kitobi: oklad + ulush (o'quvchilar to'lagan puldan foiz) + bonus − jarima − avans.
 * Ulush faqat bekor qilinmagan, shu oyda to'langan to'lovlardan. To'lov guruhga bog'lanmagan bo'lsa —
 * o'quvchining to'lov kunidagi guruhi olinadi.
 */
export async function payroll(month: string, branchId: number | null = null): Promise<PayrollRow[]> {
  const from = monthStart(month);
  const to = monthEnd(month);
  const [staff, coll, adj, paid] = await Promise.all([
    db.execute<{ id: number; full_name: string; role: string; base_salary: number; teacher_percent: number }>(sql`
      select id, full_name, role::text, base_salary, teacher_percent from users
      where active and role <> 'rahbar' ${branchId ? sql`and (branch_id = ${branchId} or branch_id is null)` : sql``}
      order by role, full_name`),
    db.execute<{ teacher_id: number; s: string }>(sql`
      select g.teacher_id, sum(p.amount)::bigint s
      from payments p
      left join lateral (
        select e.group_id from enrollments e
        where e.student_id = p.student_id and e.start_date <= p.paid_at
        order by (e.id = p.enrollment_id) desc, (e.end_date is null or e.end_date >= p.paid_at) desc, e.start_date desc limit 1
      ) en on true
      join groups g on g.id = en.group_id
      where p.cancelled_at is null and p.paid_at between ${from} and ${to} and g.teacher_id is not null
      group by 1`),
    db.execute<{ id: number; user_id: number; kind: string; amount: number; note: string | null; d: string }>(sql`
      select id, user_id, kind, amount, note, (created_at at time zone 'Asia/Tashkent')::date::text d from staff_adjustments where month = ${month} order by id`),
    db.execute<{ id: number; user_id: number; amount: number; at: string }>(sql`
      select id, user_id, amount, (created_at at time zone 'Asia/Tashkent')::date::text at from salary_payouts where month = ${month}`),
  ]);
  const cm = new Map(coll.map((c) => [c.teacher_id, Number(c.s)]));
  const pm = new Map(paid.map((p) => [p.user_id, p]));
  return staff.map((u) => {
    const a = adj.filter((x) => x.user_id === u.id);
    const sum = (k: string) => a.filter((x) => x.kind === k).reduce((s, x) => s + x.amount, 0);
    const collected = cm.get(u.id) ?? 0;
    const share = Math.round((collected * (u.teacher_percent ?? 0)) / 100);
    const bonus = sum('bonus');
    const fine = sum('jarima');
    const advance = sum('avans');
    const p = pm.get(u.id);
    return {
      userId: u.id,
      name: u.full_name,
      role: u.role,
      base: u.base_salary ?? 0,
      percent: u.teacher_percent ?? 0,
      collected,
      share,
      bonus,
      fine,
      advance,
      total: Math.max(0, (u.base_salary ?? 0) + share + bonus - fine - advance),
      paid: p ? { id: p.id, amount: p.amount, at: p.at } : null,
      adjustments: a.map((x) => ({ id: x.id, kind: x.kind, amount: x.amount, note: x.note, date: x.d })),
    };
  });
}
