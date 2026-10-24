import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { monthEnd, monthStart, thisMonth, today } from '@/lib/dates';
import { StaffView } from './view';
import { allBranches } from '@/lib/branch';

export const metadata = { title: 'Xodimlar' };

export default async function StaffPage() {
  const me = await requireSection('staff');
  const m = thisMonth();
  const from = monthStart(m);
  const to = monthEnd(m);
  const t = today();
  const [list, teach, admin, sales, tasks, reports] = await Promise.all([
    db.select({ id: users.id, branchId: users.branchId, fullName: users.fullName, phone: users.phone, role: users.role, position: users.position, baseSalary: users.baseSalary, bonusRule: users.bonusRule, active: users.active, hiredAt: users.hiredAt }).from(users).orderBy(asc(users.active), asc(users.fullName)),
    db.execute<{ uid: number; groups: number; students: number; lessons: number; late: number; missed: number; att_total: number; att_present: number }>(sql`
      select u.id uid,
        (select count(*) from groups g where g.active and (g.teacher_id = u.id or g.support_id = u.id))::int groups,
        (select count(distinct e.student_id) from enrollments e join groups g on g.id = e.group_id where e.active and e.end_date is null and g.active and (g.teacher_id = u.id or g.support_id = u.id))::int students,
        (select count(*) from lessons l join groups g on g.id = l.group_id where g.teacher_id = u.id and l.date between ${from} and ${to})::int lessons,
        (select count(*) from lessons l join groups g on g.id = l.group_id where g.teacher_id = u.id and l.teacher_status = 'kechikdi' and l.date between ${from} and ${to})::int late,
        (select count(*) from lessons l join groups g on g.id = l.group_id where g.teacher_id = u.id and l.teacher_status = 'otilmadi' and l.date between ${from} and ${to})::int missed,
        (select count(*) from attendance a join groups g on g.id = a.group_id where g.teacher_id = u.id and a.date between ${from} and ${to})::int att_total,
        (select count(*) from attendance a join groups g on g.id = a.group_id where g.teacher_id = u.id and a.status in ('keldi','kechikdi') and a.date between ${from} and ${to})::int att_present
      from users u where u.role in ('oqituvchi','support')`),
    db.execute<{ uid: number; received: string; calls: number; parent: number }>(sql`
      select u.id uid,
        (select coalesce(sum(amount),0) from payments p where p.received_by_id = u.id and p.paid_at between ${from} and ${to}) received,
        (select count(*) from notes n where n.author_id = u.id and n.kind = 'qongiroq' and n.created_at::date between ${from} and ${to})::int calls,
        (select count(*) from notes n where n.author_id = u.id and n.kind = 'ota_ona' and n.created_at::date between ${from} and ${to})::int parent
      from users u where u.role in ('admin','rahbar','bugalter')`),
    db.execute<{ uid: number; leads: number; paid: number; calls: number }>(sql`
      select u.id uid,
        (select count(*) from leads l where l.assigned_to_id = u.id and l.created_at::date between ${from} and ${to})::int leads,
        (select count(*) from leads l where l.assigned_to_id = u.id and l.stage = 'tolov_qildi' and l.updated_at::date between ${from} and ${to})::int paid,
        (select count(*) from notes n where n.author_id = u.id and n.entity_type = 'lead' and n.created_at::date between ${from} and ${to})::int calls
      from users u where u.role in ('sotuv','marketing')`),
    db.execute<{ uid: number; open: number; overdue: number; done: number }>(sql`
      select assignee_id uid,
        count(*) filter (where status <> 'bajarildi')::int open,
        count(*) filter (where status <> 'bajarildi' and due_date < ${t})::int overdue,
        count(*) filter (where status = 'bajarildi' and done_at::date between ${from} and ${to})::int done
      from tasks where assignee_id is not null group by 1`),
    db.execute<{ uid: number; c: number; last: string }>(sql`select user_id uid, count(*)::int c, max(date)::text last from staff_reports where date between ${from} and ${to} group by 1`),
  ]);
  const by = <T extends { uid: number }>(arr: T[]) => new Map(arr.map((x) => [x.uid, x]));
  const T = by(teach), A = by(admin), S = by(sales), K = by(tasks), R = by(reports);
  const branches = (await allBranches()).filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));
  return (
    <StaffView
      branches={branches}
      meId={me.id}
      month={m}
      staff={list.map((u) => ({
        ...u,
        teach: T.get(u.id) ?? null,
        admin: A.get(u.id) ? { ...A.get(u.id)!, received: Number(A.get(u.id)!.received) } : null,
        sales: S.get(u.id) ?? null,
        tasks: K.get(u.id) ?? { uid: u.id, open: 0, overdue: 0, done: 0 },
        reports: R.get(u.id) ?? null,
      }))}
    />
  );
}
