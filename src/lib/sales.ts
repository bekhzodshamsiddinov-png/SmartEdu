import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { monthEnd, monthStart } from './dates';
import { andBranch } from './branch';

export type PlanRow = { userId: number; name: string; target: number; done: number };

/**
 * Savdo rejasi bajarilishi. Sotuv hisoblanishi uchun lid o'quvchiga aylangan va
 * o'quvchining BIRINCHI to'lovi shu oyda bo'lgan bo'lishi kerak (sinov darsiga kelib, to'lagan).
 */
export async function salesProgress(month: string, branch: number | null = null): Promise<PlanRow[]> {
  const from = monthStart(month);
  const to = monthEnd(month);
  const rows = await db.execute<{ user_id: number; name: string; target: number | null; done: number }>(sql`
    with sold as (
      select l.assigned_to_id uid, count(*)::int c
      from leads l
      where l.assigned_to_id is not null and l.student_id is not null ${andBranch('l.branch_id', branch)}
        and (select min(p.paid_at) from payments p where p.student_id = l.student_id and p.cancelled_at is null) between ${from} and ${to}
      group by 1
    )
    select u.id user_id, u.full_name name, sp.target, coalesce(s.c, 0)::int done
    from users u
    left join sales_plans sp on sp.user_id = u.id and sp.month = ${month}
    left join sold s on s.uid = u.id
    where u.active and (u.role in ('sotuv') or sp.target is not null or s.c is not null)
    order by u.full_name`);
  return rows.map((r) => ({ userId: r.user_id, name: r.name, target: r.target ?? 0, done: r.done }));
}
