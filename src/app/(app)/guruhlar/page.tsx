import { asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { groups, courses, users, enrollments, students, lessons } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { seesMoney } from '@/lib/roles';
import { getBalances } from '@/lib/finance';
import { groupOptions, staffOptions } from '@/lib/options';
import { GroupsView } from './view';
import { allBranches, getBranchScope } from '@/lib/branch';

export const metadata = { title: 'Guruhlar' };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('groups');
  const support = alias(users, 'support');
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const scope = await getBranchScope();
  const branches = (await allBranches()).filter((b) => b.active);
  const roomNames = (await db.execute<{ name: string }>(sql`select name from rooms where active order by name`)).map((r) => r.name);
  const [rows, counts, cs, teachers, gopts] = await Promise.all([
    db
      .select({
        id: groups.id,
        name: groups.name,
        courseId: groups.courseId,
        course: courses.name,
        color: courses.color,
        teacherId: groups.teacherId,
        teacher: users.fullName,
        supportId: groups.supportId,
        support: support.fullName,
        days: groups.days,
        startTime: groups.startTime,
        endTime: groups.endTime,
        room: groups.room,
        capacity: groups.capacity,
        startDate: groups.startDate,
        active: groups.active,
        branchId: groups.branchId,
        billing: groups.billing,
      })
      .from(groups)
      .innerJoin(courses, eq(courses.id, groups.courseId))
      .leftJoin(users, eq(users.id, groups.teacherId))
      .leftJoin(support, eq(support.id, groups.supportId))
      .orderBy(desc(groups.active), asc(groups.startTime)),
    db.execute<{ group_id: number; c: number }>(sql`select e.group_id, count(*)::int c from enrollments e join students s on s.id = e.student_id where e.active and e.end_date is null and s.status in ('faol','xavf') group by 1`),
    db.execute<{ id: number; name: string; monthly_price: number; duration_months: number; color: string; description: string | null; active: boolean; groups: number; students: number }>(sql`
      select c.id, c.name, c.monthly_price, c.duration_months, c.color, c.description, c.active,
        count(distinct g.id) filter (where g.active)::int groups,
        count(distinct e.student_id) filter (where e.active and e.end_date is null)::int students
      from courses c left join groups g on g.course_id = c.id left join enrollments e on e.group_id = g.id
      group by c.id order by c.id`),
    staffOptions(['oqituvchi', 'support', 'rahbar', 'admin']),
    groupOptions(scope.id),
  ]);
  const countMap = new Map(counts.map((c) => [c.group_id, c.c]));
  let list = rows.map((r) => ({ ...r, students: countMap.get(r.id) ?? 0 }));
  if (mine) list = list.filter((g) => g.teacherId === user.id || g.supportId === user.id);
  if (scope.id) list = list.filter((g) => g.branchId === scope.id);

  const gid = Number(sp.id);
  let detail = null;
  if (gid && list.some((g) => g.id === gid)) {
    const [members, ls, att] = await Promise.all([
      db
        .select({ enrollmentId: enrollments.id, id: students.id, name: students.fullName, phone: students.phone, parentPhone: students.parentPhone, status: students.status, fee: enrollments.monthlyFee, startDate: enrollments.startDate })
        .from(enrollments)
        .innerJoin(students, eq(students.id, enrollments.studentId))
        .where(sql`${enrollments.groupId} = ${gid} and ${enrollments.active} and ${enrollments.endDate} is null`)
        .orderBy(asc(students.fullName)),
      db.select({ id: lessons.id, date: lessons.date, topic: lessons.topic, teacherStatus: lessons.teacherStatus }).from(lessons).where(eq(lessons.groupId, gid)).orderBy(desc(lessons.date)).limit(30),
      db.execute<{ student_id: number; total: number; present: number }>(sql`select student_id, count(*)::int total, count(*) filter (where status in ('keldi','kechikdi'))::int present from attendance where group_id = ${gid} group by 1`),
    ]);
    // Pul ma'lumotini ko'rmaydigan rollarga u umuman yuborilmaydi
    const money = seesMoney(user.role) || user.role === 'admin';
    const bal = money ? await getBalances() : new Map();
    const am = new Map(att.map((a) => [a.student_id, a]));
    detail = {
      id: gid,
      members: members.map((m) => {
        const a = am.get(m.id);
        return { ...m, fee: money ? m.fee : 0, balance: money ? (bal.get(m.id)?.balance ?? 0) : 0, att: a && a.total ? Math.round((a.present / a.total) * 100) : null };
      }),
      lessons: ls,
    };
  }

  return (
    <GroupsView
      roomNames={roomNames}
      billingDefault={(await getSettings()).billingDefault}
      groups={list}
      courses={cs.map((c) => ({ id: c.id, name: c.name, price: c.monthly_price, duration: c.duration_months, color: c.color, description: c.description, active: c.active, groups: c.groups, students: c.students }))}
      teachers={teachers}
      groupOpts={gopts}
      detail={detail}
      role={user.role}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      currentBranch={scope.id}
      tab={sp.tab === 'yonalishlar' ? 'yonalishlar' : 'guruhlar'}
    />
  );
}
