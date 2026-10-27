import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { Role } from '@/db/schema';
import { addDays, groupHasLessonOn, monthStart, weekday } from './dates';
import { getSettings } from './settings';
import { andBranch } from './branch';
import { ensureMonthlyCharges } from './billing';

export type Item = { key: string; label: string; done: number; total: number; href?: string; hint?: string };
export type StaffDay = { id: number; fullName: string; role: Role; items: Item[]; score: number | null };

export const CALL_TARGET = 20;

function weekRange(date: string) {
  const wd = (weekday(date) + 6) % 7;
  const from = addDays(date, -wd);
  return { from, to: addDays(from, 6) };
}

export function scoreOf(items: Item[]) {
  const scored = items.filter((i) => i.total > 0);
  if (!scored.length) return null;
  return Math.round((scored.reduce((s, i) => s + Math.min(1, i.done / i.total), 0) / scored.length) * 100);
}

type Base = Awaited<ReturnType<typeof loadBase>>;

async function loadBase(date: string, branch: number | null = null) {
  await ensureMonthlyCharges();
  const week = weekRange(date);
  const month = date.slice(0, 7);
  const prevMonth = (() => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return d.toISOString().slice(0, 7);
  })();
  const [staff, groups, lessons, att, absences, reports, notesBy, overdue, parentGroups, recon, exp, leadsStale, debt, grades] = await Promise.all([
    db.execute<{ id: number; full_name: string; role: Role; branch_id: number | null }>(sql`select id, full_name, role, branch_id from users where active order by role, full_name`),
    db.execute<{ id: number; name: string; days: string; teacher_id: number | null; support_id: number | null; start_time: string }>(
      sql`select id, name, days, teacher_id, support_id, start_time from groups where active ${andBranch('branch_id', branch)} order by start_time`,
    ),
    db.execute<{ group_id: number; topic: string | null; teacher_status: string; arrival_checked: boolean }>(
      sql`select group_id, topic, teacher_status, arrival_checked from lessons where date = ${date}`,
    ),
    db.execute<{ group_id: number; c: number }>(sql`select group_id, count(*)::int c from attendance where date = ${date} group by 1`),
    db.execute<{ id: number; group_id: number; called: boolean }>(sql`select a.id, a.group_id, a.called from attendance a join groups g on g.id = a.group_id where a.date between ${addDays(date, -3)} and ${date} and a.status = 'kelmadi' ${andBranch('g.branch_id', branch)}`),
    db.execute<{ user_id: number }>(sql`select distinct user_id from staff_reports where date = ${date}`),
    db.execute<{ author_id: number; calls: number }>(
      sql`select author_id, count(*)::int calls from notes where kind = 'qongiroq' and (created_at at time zone 'Asia/Tashkent')::date = ${date} group by 1`,
    ),
    db.execute<{ assignee_id: number; due: number; done: number }>(sql`
      select assignee_id, count(*)::int due, count(*) filter (where status = 'bajarildi')::int done
      from tasks where assignee_id is not null and due_date between ${addDays(date, -7)} and ${date} group by 1`),
    db.execute<{ group_id: number }>(sql`
      select distinct e.group_id from notes n join enrollments e on e.student_id = n.entity_id and e.active and e.end_date is null
      where n.entity_type = 'student' and n.kind = 'ota_ona' and (n.created_at at time zone 'Asia/Tashkent')::date between ${week.from} and ${week.to}`),
    db.execute<{ month: string }>(sql`select month from reconciliations where month = ${prevMonth}`),
    db.execute<{ total: number; with_doc: number }>(sql`
      select count(*)::int total, count(*) filter (where document is not null and document <> '')::int with_doc
      from transactions where type = 'chiqim' and date between ${monthStart(month)} and ${date} ${andBranch('branch_id', branch)}`),
    db.execute<{ assigned_to_id: number | null; total: number; stale: number }>(sql`
      select assigned_to_id, count(*)::int total,
        count(*) filter (where stage = 'yangi' and created_at < (${date}::date - interval '1 day'))::int stale
      from leads where created_at::date between ${addDays(date, -7)} and ${date} ${andBranch('branch_id', branch)} group by 1`),
    db.execute<{ debtors: number; reminded: number }>(sql`
      with bal as (
        select s.id,
          coalesce((select sum(amount) from payments p where p.student_id = s.id and p.cancelled_at is null and p.paid_at <= ${date}), 0)
          - coalesce((select sum(c.amount) from charges c where c.student_id = s.id and c.date <= ${date}), 0) as balance
        from students s where s.status in ('faol','xavf') ${andBranch('s.branch_id', branch)}
      )
      select count(*) filter (where balance < 0)::int debtors,
        count(*) filter (where balance < 0 and exists (
          select 1 from notes n where n.entity_type = 'student' and n.entity_id = bal.id and n.kind = 'qongiroq'
            and n.text like 'To''lov%' and n.created_at >= (${date}::date - interval '7 days'))) ::int reminded
      from bal`),
    db.execute<{ teacher_id: number; students: number; graded: number }>(sql`
      select g.teacher_id, count(distinct e.student_id)::int students,
        count(distinct gr.student_id)::int graded
      from groups g join enrollments e on e.group_id = g.id and e.active and e.end_date is null
      left join grades gr on gr.student_id = e.student_id and gr.period = ${month}
      where g.active and g.teacher_id is not null ${andBranch('g.branch_id', branch)} group by 1`),
  ]);
  const s = await getSettings();
  const todays = groups.filter((g) => groupHasLessonOn(g.days, date));
  return {
    date,
    week,
    month,
    prevMonth,
    dueDay: s.paymentDueDay,
    staff: [...staff],
    groups: [...groups],
    todays,
    lessons: new Map(lessons.map((l) => [l.group_id, l])),
    marked: new Map(att.map((a) => [a.group_id, a.c])),
    absences: [...absences],
    reported: new Set(reports.map((r) => r.user_id)),
    calls: new Map(notesBy.map((n) => [n.author_id, n.calls])),
    tasks: new Map(overdue.map((t) => [t.assignee_id, t])),
    parentGroups: new Set(parentGroups.map((p) => p.group_id)),
    reconDone: recon.length > 0,
    exp: exp[0],
    leads: [...leadsStale],
    debt: debt[0],
    grades: new Map(grades.map((g) => [g.teacher_id, g])),
  };
}

function common(b: Base, uid: number): Item[] {
  const t = b.tasks.get(uid);
  return [
    { key: 'report', label: 'Kunlik hisobot yozildi', done: b.reported.has(uid) ? 1 : 0, total: b.todays.length || b.reported.has(uid) ? 1 : 0, href: '/hisobotlar?tab=xodim' },
    { key: 'tasks', label: "Muddati kelgan vazifalar bajarildi", done: t?.done ?? 0, total: t?.due ?? 0, href: '/vazifalar' },
  ];
}

export function adminItems(b: Base, uid: number): Item[] {
  const lessonGroups = b.todays;
  const arrival = lessonGroups.filter((g) => b.lessons.get(g.id)?.arrival_checked).length;
  const marked = lessonGroups.filter((g) => b.marked.has(g.id)).length;
  const called = b.absences.filter((a) => a.called).length;
  return [
    { key: 'arrival', label: "O'qituvchilar kelishi belgilandi", done: arrival, total: lessonGroups.length, href: '/ish-stoli#darslar' },
    { key: 'attendance', label: 'Barcha darslarda davomat belgilandi', done: marked, total: lessonGroups.length, href: '/davomat' },
    { key: 'calls', label: "Kelmaganlarga qo'ng'iroq (3 kun)", done: called, total: b.absences.length, href: '/ish-stoli#qongiroqlar' },
    { key: 'reminders', label: "Qarzdorlarga eslatma (7 kun ichida)", done: b.debt.reminded, total: b.debt.debtors, href: '/ish-stoli#eslatmalar' },
    { key: 'parents', label: "Ota-onaga haftalik hisobot (har guruh)", done: b.groups.filter((g) => b.parentGroups.has(g.id)).length, total: b.groups.length, href: '/ish-stoli#ota-ona' },
    ...common(b, uid),
  ];
}

function teacherItems(b: Base, uid: number): Item[] {
  const mine = b.todays.filter((g) => g.teacher_id === uid || g.support_id === uid);
  const own = b.todays.filter((g) => g.teacher_id === uid);
  const ls = own.map((g) => b.lessons.get(g.id)).filter(Boolean);
  const g = b.grades.get(uid);
  const day = Number(b.date.slice(8));
  return [
    { key: 'attendance', label: "O'z darslarida davomat belgilandi", done: mine.filter((x) => b.marked.has(x.id)).length, total: mine.length, href: '/davomat' },
    { key: 'topic', label: 'Dars mavzusi yozildi', done: ls.filter((l) => l!.topic).length, total: own.length, href: '/davomat' },
    { key: 'ontime', label: 'Darsga vaqtida keldi', done: ls.filter((l) => l!.teacher_status === 'vaqtida').length, total: ls.length },
    ...(day >= 25 && g ? [{ key: 'grades', label: "Oylik baholar qo'yildi", done: g.graded, total: g.students, href: '/oquvchilar' }] : []),
    ...common(b, uid),
  ];
}

function salesItems(b: Base, uid: number): Item[] {
  const mine = b.leads.filter((l) => l.assigned_to_id === uid || l.assigned_to_id === null);
  const total = mine.reduce((s, l) => s + l.total, 0);
  const stale = mine.reduce((s, l) => s + l.stale, 0);
  return [
    { key: 'leads', label: "Yangi lidlar bilan 24 soatda bog'lanildi", done: total - stale, total, href: '/lidlar', hint: stale ? `${stale} ta lid kutib qoldi` : undefined },
    { key: 'calls', label: `Qo'ng'iroqlar (kuniga ${CALL_TARGET} ta)`, done: Math.min(CALL_TARGET, b.calls.get(uid) ?? 0), total: CALL_TARGET, hint: `${b.calls.get(uid) ?? 0} ta qilindi` },
    ...common(b, uid),
  ];
}

function accountantItems(b: Base, uid: number): Item[] {
  const day = Number(b.date.slice(8));
  return [
    ...(day > 5 ? [{ key: 'recon', label: "O'tgan oy solishtirmasi (5-sanagacha)", done: b.reconDone ? 1 : 0, total: 1, href: `/moliya?oy=${b.prevMonth}&tab=solishtirma` }] : []),
    { key: 'docs', label: 'Xarajatlar hujjat bilan kiritilgan', done: b.exp.with_doc, total: b.exp.total, href: '/moliya' },
    ...common(b, uid),
  ];
}

export async function complianceForDay(date: string): Promise<{ staff: StaffDay[]; base: Base }> {
  const all = await loadBase(date);
  const ids = [...new Set(all.staff.map((u) => u.branch_id).filter((x): x is number => !!x))];
  const per = new Map<number, Base>();
  for (const id of ids) per.set(id, await loadBase(date, id));
  const staff = all.staff
    .filter((u) => u.role !== 'rahbar')
    .map((u) => {
      const b = (u.branch_id && per.get(u.branch_id)) || all;
      const items =
        u.role === 'admin'
          ? adminItems(b, u.id)
          : u.role === 'oqituvchi' || u.role === 'support'
            ? teacherItems(b, u.id)
            : u.role === 'sotuv'
              ? salesItems(b, u.id)
              : u.role === 'bugalter'
                ? accountantItems(b, u.id)
                : common(b, u.id);
      return { id: u.id, fullName: u.full_name, role: u.role, items, score: scoreOf(items) };
    });
  return { staff, base: all };
}

export async function adminChecklist(date: string, uid: number, branch: number | null = null) {
  const b = await loadBase(date, branch);
  const items = adminItems(b, uid);
  return { items, score: scoreOf(items), base: b };
}
