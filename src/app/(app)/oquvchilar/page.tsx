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
      const [pays, att, grd, nts, res, attStat, led, frz, cn] = await Promise.all([
        db.select({ id: payments.id, amount: payments.amount, method: payments.method, paidAt: payments.paidAt, forMonth: payments.forMonth, note: payments.note, by: users.fullName, cancelledAt: payments.cancelledAt, cancelReason: payments.cancelReason }).from(payments).leftJoin(users, eq(users.id, payments.receivedById)).where(eq(payments.studentId, pid)).orderBy(desc(payments.paidAt), desc(payments.id)),
        db.select({ id: attendance.id, date: attendance.date, status: attendance.status, reason: attendance.reason, group: groups.name }).from(attendance).innerJoin(groups, eq(groups.id, attendance.groupId)).where(eq(attendance.studentId, pid)).orderBy(desc(attendance.date)).limit(60),
        db.select({ id: grades.id, period: grades.period, score: grades.score, comment: grades.comment, by: users.fullName }).from(grades).leftJoin(users, eq(users.id, grades.teacherId)).where(eq(grades.studentId, pid)).orderBy(desc(grades.period), desc(grades.id)),
        db.select({ id: notes.id, kind: notes.kind, text: notes.text, createdAt: notes.createdAt, by: users.fullName }).from(notes).leftJoin(users, eq(users.id, notes.authorId)).where(sql`${notes.entityType} = 'student' and ${notes.entityId} = ${pid}`).orderBy(desc(notes.createdAt)).limit(80),
        db.select().from(results).where(eq(results.studentId, pid)).orderBy(desc(results.date)),
        db.execute<{ total: number; present: number }>(sql`select count(*)::int total, count(*) filter (where status in ('keldi','kechikdi'))::int present from attendance where student_id = ${pid}`),
        db.execute<{ id: number; date: string; kind: string; amount: number; note: string | null; grp: string | null; status: string | null }>(sql`
          select c.id, c.date::text, c.kind, c.amount, c.note, g.name grp, a.status
          from charges c left join groups g on g.id = c.group_id left join attendance a on a.id = c.attendance_id
          where c.student_id = ${pid} and c.date <= (now() at time zone 'Asia/Tashkent')::date
          order by c.date desc, c.id desc limit 200`),
        db.execute<{ title: string }>(sql`select title from reasons where kind = 'muzlatish' and active order by position, title`),
        db.execute<{ amount: number; reason: string; d: string; by: string | null; total: number }>(sql`
          select c.amount, c.reason, (c.created_at at time zone 'Asia/Tashkent')::date::text d, u.full_name by, sum(c.amount) over ()::int total
          from coins c left join users u on u.id = c.created_by_id where c.student_id = ${pid} order by c.id desc limit 10`),
      ]);
      const b = balances.get(pid);
      profile = {
        student: (({ cabinetHash, telegramChatId, telegramLinkCode: _c, telegramLinkExpires: _e, ...rest }) => ({ ...rest, createdAt: s.createdAt.toISOString(), cabinet: cabinetHash ? 1 : 0, telegram: telegramChatId ? 1 : 0 }))(s),
        enrollments: (byStudent.get(pid) ?? []).map((e) => ({ id: e.id, group: e.group, groupId: e.groupId, course: e.course, color: e.color, fee: showMoney ? e.fee : 0, startDate: e.startDate, endDate: e.endDate, active: e.active })),
        payments: showMoney ? pays.map(({ cancelledAt, ...x }) => ({ ...x, cancelled: !!cancelledAt })) : [],
        attendance: att,
        grades: grd,
        notes: nts.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
        results: res.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        balance: showMoney ? { charged: b?.charged ?? 0, paid: b?.paid ?? 0, balance: b?.balance ?? 0, fee: b?.monthlyFee ?? 0 } : { charged: 0, paid: 0, balance: 0, fee: 0 },
        ledger: showMoney ? led.map((r) => ({ ...r, amount: Number(r.amount) })) : [],
        freezeReasons: frz.map((r) => r.title),
        coins: { total: cn[0]?.total ?? 0, rows: cn.map(({ total: _t, ...r }) => r) },
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
