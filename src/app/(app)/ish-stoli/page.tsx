import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { tasks, staffReports } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { adminChecklist } from '@/lib/compliance';
import { getBalances } from '@/lib/finance';
import { addDays, today } from '@/lib/dates';
import { DeskView } from './view';
import { andBranch, getBranchScope } from '@/lib/branch';

export const metadata = { title: 'Ish stoli' };

export default async function DeskPage() {
  const user = await requireSection('desk');
  const t = today();
  const scope = await getBranchScope();
  const B = scope.id;
  const { items, score, base } = await adminChecklist(t, user.id, B);

  const [groupsInfo, absents, streak, pays, myTasks, myReport, reminded, students] = await Promise.all([
    db.execute<{ id: number; name: string; course: string; color: string; teacher: string | null; room: string | null; start_time: string; end_time: string; students: number }>(sql`
      select g.id, g.name, c.name course, c.color, u.full_name teacher, g.room, g.start_time, g.end_time,
        (select count(*) from enrollments e where e.group_id = g.id and e.active and e.end_date is null)::int students
      from groups g join courses c on c.id = g.course_id left join users u on u.id = g.teacher_id where g.active ${andBranch('g.branch_id', B)} order by g.start_time`),
    db.execute<{ id: number; date: string; reason: string | null; student_id: number; name: string; phone: string | null; parent_phone: string | null; group_name: string }>(sql`
      select a.id, a.date::text, a.reason, s.id student_id, s.full_name name, s.phone, s.parent_phone, g.name group_name
      from attendance a join students s on s.id = a.student_id join groups g on g.id = a.group_id
      where a.status = 'kelmadi' and not a.called and a.date between ${addDays(t, -3)} and ${t} ${andBranch('g.branch_id', B)}
      order by a.date desc, s.full_name`),
    db.execute<{ student_id: number }>(sql`
      select student_id from (
        select student_id, status, row_number() over (partition by student_id order by date desc) rn from attendance
      ) x where rn <= 2 group by student_id having count(*) = 2 and count(*) filter (where status = 'kelmadi') = 2`),
    db.execute<{ c: number; s: string; cash: string }>(sql`select count(*)::int c, coalesce(sum(amount),0) s, coalesce(sum(amount) filter (where method = 'naqd'),0) cash from payments p where p.paid_at = ${t} ${B ? sql`and p.branch_id = ${B}` : sql``}`),
    db.select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, status: tasks.status }).from(tasks).where(and(eq(tasks.assigneeId, user.id), ne(tasks.status, 'bajarildi'))).orderBy(asc(tasks.dueDate)).limit(8),
    db.select({ id: staffReports.id, done: staffReports.done }).from(staffReports).where(and(eq(staffReports.userId, user.id), eq(staffReports.date, t))).orderBy(desc(staffReports.id)).limit(1),
    db.execute<{ entity_id: number }>(sql`select distinct entity_id from notes where entity_type = 'student' and kind = 'qongiroq' and text like 'To''lov%' and created_at >= now() - interval '7 days'`),
    db.execute<{ id: number; name: string; parent_phone: string | null; phone: string | null; parent_name: string | null }>(sql`select id, full_name name, parent_phone, phone, parent_name from students where status in ('faol','xavf') ${andBranch('branch_id', B)}`),
  ]);

  const balances = await getBalances(t);
  const remindedSet = new Set(reminded.map((r) => r.entity_id));
  const debtors = students
    .map((s) => ({ ...s, debt: -(balances.get(s.id)?.balance ?? 0), months: balances.get(s.id)?.overdueMonths ?? 0, reminded: remindedSet.has(s.id) }))
    .filter((s) => s.debt > 0)
    .sort((a, b) => Number(a.reminded) - Number(b.reminded) || b.debt - a.debt);
  const streakSet = new Set(streak.map((s) => s.student_id));

  const lessonsToday = base.todays.map((g) => {
    const info = groupsInfo.find((x) => x.id === g.id)!;
    const l = base.lessons.get(g.id);
    return {
      ...info,
      arrival: l?.arrival_checked ? l.teacher_status : null,
      marked: base.marked.get(g.id) ?? 0,
    };
  });

  return (
    <DeskView
      userName={user.fullName.split(' ')[0]}
      date={t}
      items={items}
      score={score}
      lessons={lessonsToday}
      absents={absents.map((a) => ({ ...a, streak: streakSet.has(a.student_id) }))}
      debtors={debtors}
      parentGroups={groupsInfo.map((g) => ({ id: g.id, name: g.name, course: g.course, color: g.color, students: g.students, done: base.parentGroups.has(g.id) }))}
      pays={{ count: pays[0].c, sum: Number(pays[0].s), cash: Number(pays[0].cash) }}
      tasks={myTasks}
      reportDone={myReport.length > 0}
      dueDay={base.dueDay}
    />
  );
}
