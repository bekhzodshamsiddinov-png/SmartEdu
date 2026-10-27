import Link from 'next/link';
import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed, Clock, PhoneMissed, Wallet } from 'lucide-react';
import { db } from '@/db';
import { groups, courses, users, tasks, students, lessons, attendance } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { can, seesMoney } from '@/lib/roles';
import { fmtDate, groupHasLessonOn, periodRange, thisMonth, today, WEEKDAYS_FULL, weekday } from '@/lib/dates';
import { money, num, pct, compactMoney } from '@/lib/format';
import { absentStreakIds, getBalances } from '@/lib/finance';
import { attendanceRate, funnel, incomeExpense, leftReasons, monthlySeries, studentFlow, studentsByCourse } from '@/lib/stats';
import { Badge, Card, CardHeader, Empty, Stat, cn } from '@/components/ui';
import { PeriodTabs, parsePeriod } from '@/components/period-tabs';
import { MoneyBars } from '@/components/charts/money-bars';
import { getBranchScope } from '@/lib/branch';

export const metadata = { title: 'Bosh sahifa' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const period = parsePeriod(sp.davr);
  const range = periodRange(period);
  const t = today();
  const money_ = seesMoney(user.role);
  const scope = await getBranchScope();
  const B = scope.id;

  const [flow, att, fun, byCourse, reasons, balances, streak, todayGroups, todayLessons, todayAtt, overdue] = await Promise.all([
    studentFlow(range.from, range.to, B),
    attendanceRate(range.from, range.to, B),
    funnel(range.from, range.to, B),
    studentsByCourse(B),
    leftReasons(range.from, range.to, B),
    getBalances(t),
    absentStreakIds(),
    db
      .select({ id: groups.id, name: groups.name, days: groups.days, start: groups.startTime, end: groups.endTime, room: groups.room, course: courses.name, color: courses.color, teacher: users.fullName, teacherId: groups.teacherId })
      .from(groups)
      .innerJoin(courses, eq(courses.id, groups.courseId))
      .leftJoin(users, eq(users.id, groups.teacherId))
      .where(and(eq(groups.active, true), B ? eq(groups.branchId, B) : undefined))
      .orderBy(asc(groups.startTime)),
    db.select().from(lessons).where(eq(lessons.date, t)),
    db.execute<{ group_id: number; total: number; present: number }>(sql`select group_id, count(*)::int total, count(*) filter (where status in ('keldi','kechikdi'))::int present from attendance where date = ${t} group by group_id`),
    db
      .select({ id: tasks.id, title: tasks.title, due: tasks.dueDate, who: users.fullName })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(ne(tasks.status, 'bajarildi'), lt(tasks.dueDate, t), user.role === 'rahbar' ? undefined : eq(tasks.assigneeId, user.id)))
      .orderBy(asc(tasks.dueDate))
      .limit(5),
  ]);
  const ie = money_ ? await incomeExpense(range.from, range.to, B) : null;
  const series = money_ ? await monthlySeries(thisMonth(), 12, B) : [];

  const activeIds = await db.select({ id: students.id, name: students.fullName }).from(students).where(sql`${students.status} in ('faol','xavf') ${B ? sql`and ${students.branchId} = ${B}` : sql``}`);
  const activeMap = new Map(activeIds.map((s) => [s.id, s.name]));
  const debtors = [...balances.entries()]
    .filter(([id, b]) => activeMap.has(id) && b.balance < 0)
    .map(([id, b]) => ({ id, name: activeMap.get(id)!, debt: -b.balance, months: b.overdueMonths }))
    .sort((a, b) => b.debt - a.debt);
  const debtSum = debtors.reduce((s, d) => s + d.debt, 0);
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  // O'qituvchi faqat o'z o'quvchilarini, o'quvchilar bo'limi yo'q rollar esa hech kimni ko'rmaydi
  const ownIds = mine
    ? new Set(
        (await db.execute<{ id: number }>(sql`select distinct e.student_id id from enrollments e join groups g on g.id = e.group_id
          where e.active and e.end_date is null and (g.teacher_id = ${user.id} or g.support_id = ${user.id})`)).map((r) => r.id),
      )
    : null;
  const streakList = can(user.role, 'students')
    ? [...streak].filter((id) => activeMap.has(id) && (!ownIds || ownIds.has(id))).map((id) => ({ id, name: activeMap.get(id)! }))
    : [];
  const lessonsToday = todayGroups.filter((g) => groupHasLessonOn(g.days, t) && (!mine || g.teacherId === user.id));
  const lessonMap = new Map(todayLessons.map((l) => [l.groupId, l]));
  const attMap = new Map(todayAtt.map((a) => [a.group_id, a]));

  const first = user.fullName.split(' ')[0];
  const maxCourse = Math.max(1, ...byCourse.map((c) => c.c));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-fg-muted">
            {WEEKDAYS_FULL[weekday(t)]}, {fmtDate(t)}
            {scope.name && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-strong">{scope.name}</span>}
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Assalomu alaykum, {first}</h1>
        </div>
        <PeriodTabs value={period} />
      </div>

      {/* Bugungi darslar lentasi */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-[15px] font-bold">Bugungi darslar</h2>
            <p className="text-[13px] text-fg-muted">
              {lessonsToday.length ? `${lessonsToday.length} ta dars, davomat ${lessonsToday.filter((g) => attMap.has(g.id)).length} tasida belgilangan` : 'Bugun dars yo\'q'}
            </p>
          </div>
          {can(user.role, 'attendance') && (
            <Link href="/davomat" className="text-[13px] font-bold text-brand hover:underline">
              Davomatga o&apos;tish
            </Link>
          )}
        </div>
        {lessonsToday.length === 0 ? (
          <div className="border-t border-line px-5 py-6 text-sm text-fg-muted">Dars jadvali guruhlar bo&apos;limida belgilanadi.</div>
        ) : (
          <div className="flex gap-3 overflow-x-auto border-t border-line bg-canvas/60 px-5 py-4">
            {lessonsToday.map((g) => {
              const a = attMap.get(g.id);
              const l = lessonMap.get(g.id);
              const done = !!a;
              return (
                <Link
                  key={g.id}
                  href={`/davomat?guruh=${g.id}&sana=${t}`}
                  className="group relative min-w-[220px] flex-1 rounded-xl border border-line bg-white p-3.5 transition-colors hover:border-line-strong"
                >
                  <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: g.color }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-extrabold tnum">
                      {g.start}
                      <span className="font-semibold text-fg-faint">–{g.end}</span>
                    </span>
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-good">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {a.present}/{a.total}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-fg-faint">
                        <CircleDashed className="h-3.5 w-3.5" /> Belgilanmagan
                      </span>
                    )}
                  </div>
                  <div className="mt-2 truncate text-sm font-bold">{g.name}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {g.course}
                    {g.room ? `, ${g.room}-xona` : ''}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                    <span className="truncate">{g.teacher || "O'qituvchi biriktirilmagan"}</span>
                    {l && l.teacherStatus !== 'vaqtida' && <Badge tone={l.teacherStatus === 'otilmadi' ? 'bad' : 'warn'}>{l.teacherStatus === 'otilmadi' ? "O'tilmadi" : 'Kechikdi'}</Badge>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Faol o'quvchilar" value={num(flow.active)} hint={flow.frozen ? `${flow.frozen} ta muzlatilgan` : 'Hozir o\'qiyotganlar'} href="/oquvchilar" />
        <Stat label={`Qo'shildi · ${range.label.toLowerCase()}`.replace(' · ', ', ')} value={num(flow.joined)} tone={flow.joined ? 'good' : 'neutral'} hint={flow.grad ? `${flow.grad} ta bitirdi` : undefined} />
        <Stat label={`Ketdi, ${range.label.toLowerCase()}`} value={num(flow.left)} tone={flow.left ? 'bad' : 'neutral'} hint={reasons[0] ? `Asosiy sabab: ${reasons[0].reason}` : undefined} />
        <Stat label="O'rtacha davomat" value={pct(att.rate)} tone={att.rate < 80 ? 'warn' : 'neutral'} hint={att.total ? `${num(att.total)} ta belgidan` : 'Davomat hali belgilanmagan'} />
        {ie && (
          <>
            <Stat label={`Kirim, ${range.label.toLowerCase()}`} value={compactMoney(ie.income)} hint={money(ie.income)} />
            <Stat label="Xarajatlar" value={compactMoney(ie.expense)} hint={money(ie.expense)} />
            <Stat label="Sof foyda" value={compactMoney(ie.profit)} tone={ie.profit >= 0 ? 'good' : 'bad'} hint={money(ie.profit)} />
          </>
        )}
        {(money_ || user.role === 'admin') && (
          <Stat label="Qarzdorlik" value={compactMoney(debtSum)} tone={debtSum ? 'bad' : 'neutral'} hint={`${debtors.length} ta o'quvchi`} href="/tolovlar?tab=qarzdorlar" />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {money_ && (
          <Card className="xl:col-span-2">
            <CardHeader title="Kirim va xarajat" sub="Oxirgi 12 oy, so'm" action={<Link href="/moliya" className="text-[13px] font-bold text-brand hover:underline">Moliya</Link>} />
            <div className="px-3 pb-4 sm:px-5">
              <MoneyBars data={series} />
            </div>
          </Card>
        )}

        <Card className={cn(!money_ && 'xl:col-span-2')}>
          <CardHeader title="Diqqat talab qiladi" sub="Bugun hal qilish kerak bo'lganlar" />
          <div className="divide-y divide-line border-t border-line">
            <AttentionGroup
              icon={<Wallet className="h-4 w-4" />}
              tone="bad"
              title="Qarzdorlar"
              count={debtors.length}
              href="/tolovlar?tab=qarzdorlar"
              items={debtors.slice(0, 4).map((d) => ({ href: `/oquvchilar?id=${d.id}`, left: d.name, right: money(d.debt) }))}
              show={money_ || user.role === 'admin'}
            />
            <AttentionGroup
              icon={<PhoneMissed className="h-4 w-4" />}
              tone="warn"
              title="Ketma-ket 2 dars kelmadi"
              count={streakList.length}
              href="/davomat?tab=kelmaganlar"
              items={streakList.slice(0, 4).map((d) => ({ href: `/oquvchilar?id=${d.id}`, left: d.name, right: "Qo'ng'iroq qiling" }))}
              show={can(user.role, 'students')}
            />
            <AttentionGroup
              icon={<CalendarClock className="h-4 w-4" />}
              tone="info"
              title="Muddati o'tgan vazifalar"
              count={overdue.length}
              href="/vazifalar"
              items={overdue.map((d) => ({ href: '/vazifalar', left: d.title, right: d.who || '' }))}
              show
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Sotuv voronkasi" sub={`${range.label}da kelgan lidlar`} action={can(user.role, 'leads') ? <Link href="/lidlar" className="text-[13px] font-bold text-brand hover:underline">Lidlar</Link> : undefined} />
          <div className="space-y-3 px-5 pb-5">
            {fun.total === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">Bu davrda lid kelmagan.</p>
            ) : (
              [
                { l: 'Lidlar', v: fun.total },
                { l: "Bog'lanildi", v: fun.contacted },
                { l: 'Sinov darsiga yozildi', v: fun.trial },
                { l: 'Sinov darsiga keldi', v: fun.came },
                { l: "To'lov qildi", v: fun.paid },
              ].map((s, i, arr) => (
                <div key={s.l}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold">{s.l}</span>
                    <span className="tnum text-fg-muted">
                      <b className="text-fg">{s.v}</b>
                      {i > 0 && arr[i - 1].v > 0 && <span className="ml-1.5">{pct((s.v / arr[i - 1].v) * 100)}</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(s.v / fun.total) * 100}%`, opacity: 1 - i * 0.14 }} />
                  </div>
                </div>
              ))
            )}
            {fun.total > 0 && (
              <p className="pt-1 text-xs text-fg-muted">
                Umumiy konversiya: <b className="text-fg">{pct((fun.paid / fun.total) * 100)}</b>, rad etdi: {fun.lost}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Yo'nalishlar bo'yicha o'quvchilar" sub="Hozir faol" />
          <div className="space-y-3.5 px-5 pb-5">
            {byCourse.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Yo&apos;nalishlar qo&apos;shilmagan.</p>}
            {byCourse.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <b className="tnum">{c.c}</b>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full" style={{ width: `${(c.c / maxCourse) * 100}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Nega ketishdi" sub={range.label} action={<Link href="/hisobotlar" className="text-[13px] font-bold text-brand hover:underline">Hisobot</Link>} />
          <div className="px-5 pb-5">
            {reasons.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">Bu davrda hech kim ketmagan.</p>
            ) : (
              <ul className="divide-y divide-line">
                {reasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{r.reason}</span>
                    <span className="shrink-0 tnum text-fg-muted">
                      <b className="text-fg">{r.c}</b>
                      {r.returned > 0 && <span className="ml-2 text-good">{r.returned} qaytdi</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
      {sp.ruxsat === 'yoq' && (
        <p className="flex items-center gap-2 text-sm text-warn">
          <AlertTriangle className="h-4 w-4" /> Bu bo&apos;limga kirish uchun ruxsatingiz yo&apos;q.
        </p>
      )}
    </div>
  );
}

function AttentionGroup({
  icon,
  tone,
  title,
  count,
  href,
  items,
  show,
}: {
  icon: React.ReactNode;
  tone: 'bad' | 'warn' | 'info';
  title: string;
  count: number;
  href: string;
  items: { href: string; left: string; right: string }[];
  show: boolean;
}) {
  if (!show) return null;
  const c = { bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', info: 'bg-info-soft text-info' }[tone];
  return (
    <div className="px-5 py-3.5">
      <Link href={href} className="flex items-center gap-3">
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg', c)}>{icon}</span>
        <span className="flex-1 text-sm font-bold">{title}</span>
        <span className="text-sm font-extrabold tnum">{count}</span>
      </Link>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-11">
          {items.map((it, i) => (
            <li key={i}>
              <Link href={it.href} className="flex justify-between gap-3 text-[13px] hover:text-brand">
                <span className="truncate">{it.left}</span>
                <span className="shrink-0 text-fg-muted tnum">{it.right}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 pl-11 text-[13px] text-fg-faint">Hammasi joyida</p>
      )}
    </div>
  );
}
