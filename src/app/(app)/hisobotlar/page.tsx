import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { staffReports, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { seesMoney } from '@/lib/roles';
import { monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { attendanceRate, expensesByCategory, funnel, incomeExpense, leftReasons, revenueByCourse, studentFlow } from '@/lib/stats';
import { ReportsView } from './view';

export const metadata = { title: 'Hisobotlar' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('reports');
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const from = monthStart(month);
  const to = monthEnd(month);
  const tab = sp.tab === 'xodim' || sp.yangi === '1' ? 'xodim' : 'oylik';
  const manager = ['rahbar', 'admin', 'bugalter'].includes(user.role);
  const showMonthly = manager;

  const reports = await db
    .select({ id: staffReports.id, date: staffReports.date, kind: staffReports.kind, done: staffReports.done, problems: staffReports.problems, plan: staffReports.plan, user: users.fullName, role: users.role, userId: staffReports.userId })
    .from(staffReports)
    .innerJoin(users, eq(users.id, staffReports.userId))
    .where(user.role === 'rahbar' ? sql`${staffReports.date} >= current_date - 45` : sql`${staffReports.userId} = ${user.id} and ${staffReports.date} >= current_date - 45`)
    .orderBy(desc(staffReports.date), desc(staffReports.id))
    .limit(150);

  let monthly = null;
  if (showMonthly) {
    const [flow, att, fun, reasons, ie, rev, exp, byCourse, bySource, byGroup, res] = await Promise.all([
      studentFlow(from, to),
      attendanceRate(from, to),
      funnel(from, to),
      leftReasons(from, to),
      seesMoney(user.role) ? incomeExpense(from, to) : null,
      seesMoney(user.role) ? revenueByCourse(from, to) : [],
      seesMoney(user.role) ? expensesByCategory(from, to) : [],
      db.execute<{ name: string; color: string; active: number; joined: number; left: number }>(sql`
        select c.name, c.color,
          count(distinct s.id) filter (where s.status in ('faol','xavf') and e.active and e.end_date is null)::int active,
          count(distinct s.id) filter (where e.start_date between ${from} and ${to})::int joined,
          count(distinct s.id) filter (where s.left_at between ${from} and ${to})::int "left"
        from courses c left join groups g on g.course_id = c.id left join enrollments e on e.group_id = g.id left join students s on s.id = e.student_id
        group by c.id order by c.id`),
      db.execute<{ source: string; total: number; paid: number }>(sql`
        select source, count(*)::int total, count(*) filter (where max_stage >= 4)::int paid from leads where created_at::date between ${from} and ${to} group by 1 order by 2 desc`),
      db.execute<{ name: string; teacher: string | null; total: number; present: number; lessons: number; late: number; missed: number }>(sql`
        select g.name, u.full_name teacher,
          (select count(*) from attendance a where a.group_id = g.id and a.date between ${from} and ${to})::int total,
          (select count(*) from attendance a where a.group_id = g.id and a.status in ('keldi','kechikdi') and a.date between ${from} and ${to})::int present,
          (select count(*) from lessons l where l.group_id = g.id and l.date between ${from} and ${to})::int lessons,
          (select count(*) from lessons l where l.group_id = g.id and l.teacher_status = 'kechikdi' and l.date between ${from} and ${to})::int late,
          (select count(*) from lessons l where l.group_id = g.id and l.teacher_status = 'otilmadi' and l.date between ${from} and ${to})::int missed
        from groups g left join users u on u.id = g.teacher_id where g.active order by g.name`),
      db.execute<{ type: string; c: number }>(sql`select type, count(*)::int c from results where date between ${from} and ${to} group by 1 order by 2 desc`),
    ]);
    monthly = {
      flow,
      att,
      fun,
      reasons: [...reasons],
      ie,
      rev: rev.map((r) => ({ name: r.name, color: r.color, s: Number(r.s) })),
      exp: exp.map((r) => ({ category: r.category, s: Number(r.s) })),
      byCourse: [...byCourse],
      bySource: [...bySource],
      byGroup: [...byGroup],
      results: [...res],
    };
  }

  return <ReportsView month={month} tab={showMonthly ? tab : 'xodim'} showMonthly={showMonthly} monthly={monthly} reports={reports} isBoss={user.role === 'rahbar'} />;
}
