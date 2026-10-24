import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students, enrollments, groups, courses, payments, attendance, grades, notes, results, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { seesMoney } from '@/lib/roles';
import { absentStreakIds, getBalances } from '@/lib/finance';
import { groupOptions, courseOptions } from '@/lib/options';
import { StudentsView, type StudentRow, type Profile } from './view';
import { getBranchScope } from '@/lib/branch';

export const metadata = { title: "O'quvchilar" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('students');
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const scope = await getBranchScope();

  const [all, enr, balances, gopts, copts, streak] = await Promise.all([
    db.select().from(students).orderBy(desc(students.id)),
    db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        groupId: enrollments.groupId,
        fee: enrollments.monthlyFee,
        active: enrollments.active,
        endDate: enrollments.endDate,
        startDate: enrollments.startDate,
        group: groups.name,
        courseId: groups.courseId,
        course: courses.name,
        color: courses.color,
        teacherId: groups.teacherId,
        supportId: groups.supportId,
      })
      .from(enrollments)
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .innerJoin(courses, eq(courses.id, groups.courseId)),
    getBalances(),
    groupOptions(scope.id),
    courseOptions(),
    absentStreakIds(),
  ]);

  const byStudent = new Map<number, typeof enr>();
  for (const e of enr) byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), e]);

  let rows: StudentRow[] = all.filter((s) => !scope.id || s.branchId === scope.id).map((s) => {
    const es = byStudent.get(s.id) ?? [];
    const cur = es.filter((e) => e.active && !e.endDate);
    const b = balances.get(s.id);
    return {
      id: s.id,
      fullName: s.fullName,
      phone: s.phone,
      parentPhone: s.parentPhone,
      status: s.status === 'faol' && streak.has(s.id) ? 'xavf' : s.status,
      joinedAt: s.joinedAt,
      groups: (cur.length ? cur : es.slice(-1)).map((e) => ({ id: e.groupId, name: e.group, course: e.course, courseId: e.courseId, color: e.color, current: e.active && !e.endDate })),
      balance: b?.balance ?? 0,
      fee: b?.monthlyFee ?? 0,
      teacherIds: es.flatMap((e) => [e.teacherId, e.supportId]).filter(Boolean) as number[],
      enrollments: cur.map((e) => ({ id: e.id, label: `${e.group} (${e.course})` })),
    };
  });
  if (mine) rows = rows.filter((r) => r.teacherIds.includes(user.id));
  // Pul ma'lumotini ko'rmaydigan rollarga u umuman yuborilmaydi (faqat yashirish emas)
  const showMoney = seesMoney(user.role) || user.role === 'admin';
  if (!showMoney) rows = rows.map((r) => ({ ...r, balance: 0, fee: 0 }));

  let profile: Profile | null = null;
  const pid = Number(sp.id);
  if (pid) {
    const s = all.find((x) => x.id === pid);
    if (s && rows.some((r) => r.id === pid)) {
      const [pays, att, grd, nts, res, attStat] = await Promise.all([
        db.select({ id: payments.id, amount: payments.amount, method: payments.method, paidAt: payments.paidAt, forMonth: payments.forMonth, note: payments.note, by: users.fullName }).from(payments).leftJoin(users, eq(users.id, payments.receivedById)).where(eq(payments.studentId, pid)).orderBy(desc(payments.paidAt), desc(payments.id)),
        db.select({ id: attendance.id, date: attendance.date, status: attendance.status, reason: attendance.reason, group: groups.name }).from(attendance).innerJoin(groups, eq(groups.id, attendance.groupId)).where(eq(attendance.studentId, pid)).orderBy(desc(attendance.date)).limit(60),
        db.select({ id: grades.id, period: grades.period, score: grades.score, comment: grades.comment, by: users.fullName }).from(grades).leftJoin(users, eq(users.id, grades.teacherId)).where(eq(grades.studentId, pid)).orderBy(desc(grades.period), desc(grades.id)),
        db.select({ id: notes.id, kind: notes.kind, text: notes.text, createdAt: notes.createdAt, by: users.fullName }).from(notes).leftJoin(users, eq(users.id, notes.authorId)).where(sql`${notes.entityType} = 'student' and ${notes.entityId} = ${pid}`).orderBy(desc(notes.createdAt)).limit(80),
        db.select().from(results).where(eq(results.studentId, pid)).orderBy(desc(results.date)),
        db.execute<{ total: number; present: number }>(sql`select count(*)::int total, count(*) filter (where status in ('keldi','kechikdi'))::int present from attendance where student_id = ${pid}`),
      ]);
      const b = balances.get(pid);
      profile = {
        student: { ...s, createdAt: s.createdAt.toISOString() },
        enrollments: (byStudent.get(pid) ?? []).map((e) => ({ id: e.id, group: e.group, groupId: e.groupId, course: e.course, color: e.color, fee: showMoney ? e.fee : 0, startDate: e.startDate, endDate: e.endDate, active: e.active })),
        payments: showMoney ? pays : [],
        attendance: att,
        grades: grd,
        notes: nts.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
        results: res.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        balance: showMoney ? { charged: b?.charged ?? 0, paid: b?.paid ?? 0, balance: b?.balance ?? 0, fee: b?.monthlyFee ?? 0 } : { charged: 0, paid: 0, balance: 0, fee: 0 },
        attRate: attStat[0].total ? Math.round((attStat[0].present / attStat[0].total) * 100) : null,
      };
    }
  }

  return (
    <StudentsView
      rows={rows}
      profile={profile}
      groups={gopts}
      courses={copts}
      role={user.role}
      showMoney={showMoney}
      openNew={sp.yangi === '1'}
      initial={{ q: sp.q ?? '', holat: sp.holat ?? '', yonalish: sp.yonalish ?? '', guruh: sp.guruh ?? '' }}
    />
  );
}
