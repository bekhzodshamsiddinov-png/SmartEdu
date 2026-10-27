import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { getBranchScope, allBranches } from '@/lib/branch';
import { today, weekday, WEEKDAYS } from '@/lib/dates';
import { ScheduleView } from './view';

export const metadata = { title: 'Dars jadvali' };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('schedule');
  const scope = await getBranchScope();
  const B = scope.id;
  const [gs, rs, branches] = await Promise.all([
    db.execute<{ id: number; name: string; days: string; start_time: string; end_time: string; room: string | null; capacity: number; teacher_id: number | null; teacher: string | null; course: string; color: string; branch_id: number | null; students: number; done: number; total: number }>(sql`
      select g.id, g.name, g.days, g.start_time, g.end_time, g.room, g.capacity, g.teacher_id, u.full_name teacher, c.name course, c.color, g.branch_id,
        (select count(*) from enrollments e where e.group_id = g.id and e.active and e.end_date is null)::int students,
        (select count(*) from lessons l where l.group_id = g.id)::int done,
        (c.duration_months * round(array_length(string_to_array(g.days, ','), 1) * 4.33))::int total
      from groups g join courses c on c.id = g.course_id left join users u on u.id = g.teacher_id
      where g.active ${B ? sql`and g.branch_id = ${B}` : sql``}
      order by g.start_time`),
    db.execute<{ id: number; name: string; capacity: number; active: boolean; branch_id: number | null }>(sql`
      select id, name, capacity, active, branch_id from rooms ${B ? sql`where branch_id = ${B} or branch_id is null` : sql``} order by active desc, name`),
    allBranches(),
  ]);
  const day = WEEKDAYS.includes(sp.kun ?? '') ? sp.kun! : WEEKDAYS[weekday(today())];
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  return (
    <ScheduleView
      day={day}
      groups={[...gs].map((g) => ({ id: g.id, name: g.name, days: g.days.split(','), start: g.start_time, end: g.end_time, room: g.room?.trim() || null, capacity: g.capacity, teacherId: g.teacher_id, teacher: g.teacher, course: g.course, color: g.color, branchId: g.branch_id, students: g.students, done: g.done, total: g.total }))}
      rooms={[...rs].map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, active: r.active, branchId: r.branch_id }))}
      branches={branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }))}
      currentBranch={B}
      canManage={user.role === 'rahbar' || user.role === 'admin'}
      meId={mine ? user.id : null}
    />
  );
}
