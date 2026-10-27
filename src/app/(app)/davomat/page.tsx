import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { groups, courses, users, enrollments, students, attendance, lessons, reasons } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { addDays, groupHasLessonOn, today } from '@/lib/dates';
import { AttendanceView } from './view';
import { getBranchScope } from '@/lib/branch';

export const metadata = { title: 'Davomat' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('attendance');
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const t = today();
  const scope = await getBranchScope();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.sana ?? '') ? sp.sana : t;

  let gs = await db
    .select({ id: groups.id, name: groups.name, course: courses.name, color: courses.color, days: groups.days, start: groups.startTime, end: groups.endTime, teacherId: groups.teacherId, supportId: groups.supportId, teacher: users.fullName, billing: groups.billing })
    .from(groups)
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .leftJoin(users, eq(users.id, groups.teacherId))
    .where(and(eq(groups.active, true), scope.id ? eq(groups.branchId, scope.id) : undefined))
    .orderBy(asc(groups.startTime));
  if (mine) gs = gs.filter((g) => g.teacherId === user.id || g.supportId === user.id);

  const todays = gs.filter((g) => groupHasLessonOn(g.days, date));
  const gid = Number(sp.guruh) || todays[0]?.id || gs[0]?.id || null;
  const g = gs.find((x) => x.id === gid) ?? null;

  let members: { id: number; name: string; status: string }[] = [];
  let marks: { studentId: number; status: string; reason: string | null; reasonId: number | null }[] = [];
  let lesson: { topic: string | null; teacherStatus: string } | null = null;
  if (g) {
    members = await db
      .select({ id: students.id, name: students.fullName, status: students.status })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(sql`${enrollments.groupId} = ${g.id} and ${enrollments.startDate} <= ${date} and (${enrollments.endDate} is null or ${enrollments.endDate} >= ${date})`)
      .orderBy(asc(students.fullName));
    marks = await db.select({ studentId: attendance.studentId, status: attendance.status, reason: attendance.reason, reasonId: attendance.reasonId }).from(attendance).where(and(eq(attendance.groupId, g.id), eq(attendance.date, date)));
    const [l] = await db.select({ topic: lessons.topic, teacherStatus: lessons.teacherStatus }).from(lessons).where(and(eq(lessons.groupId, g.id), eq(lessons.date, date)));
    lesson = l ?? null;
  }

  const reasonOpts = await db.select({ id: reasons.id, title: reasons.title, charges: reasons.charges }).from(reasons).where(and(eq(reasons.kind, 'davomat'), eq(reasons.active, true))).orderBy(asc(reasons.position), asc(reasons.title));
  const since = addDays(t, -14);
  const absents = await db
    .select({ id: attendance.id, date: attendance.date, reason: attendance.reason, called: attendance.called, studentId: students.id, name: students.fullName, phone: students.phone, parentPhone: students.parentPhone, group: groups.name, teacherId: groups.teacherId, supportId: groups.supportId })
    .from(attendance)
    .innerJoin(students, eq(students.id, attendance.studentId))
    .innerJoin(groups, eq(groups.id, attendance.groupId))
    .where(sql`${attendance.status} = 'kelmadi' and ${attendance.date} >= ${since} ${scope.id ? sql`and ${groups.branchId} = ${scope.id}` : sql``}`)
    .orderBy(asc(attendance.called), desc(attendance.date));

  const absentList = mine ? absents.filter((a) => a.teacherId === user.id || a.supportId === user.id) : absents;
  const marked = await db.execute<{ group_id: number }>(sql`select distinct group_id from attendance where date = ${date}`);

  return (
    <AttendanceView
      reasonOpts={reasonOpts}
      billing={g?.billing ?? 'oylik'}
      groups={gs.map((x) => ({ ...x, today: groupHasLessonOn(x.days, date) }))}
      markedIds={marked.map((m) => m.group_id)}
      group={g ? { ...g, today: groupHasLessonOn(g.days, date) } : null}
      date={date}
      todayStr={t}
      members={members}
      marks={marks}
      lesson={lesson}
      absents={absentList}
      canSetTeacher={!mine}
      tab={sp.tab === 'kelmaganlar' ? 'kelmaganlar' : 'belgilash'}
    />
  );
}
