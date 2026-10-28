import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { studentBalance } from './finance';
import { addDays, today, WEEKDAYS } from './dates';

export type Overview = Awaited<ReturnType<typeof childOverview>>;

/** Ilova bosh sahifasi uchun bitta so'rovlar to'plami */
export async function childOverview(sid: number) {
  const t = today();
  const [balance, groups, att, coins, subs, grades, wins] = await Promise.all([
    studentBalance(sid),
    db.execute<{ id: number; name: string; course: string; color: string; days: string; start_time: string; end_time: string; room: string | null; teacher: string | null; fee: number }>(sql`
      select g.id, g.name, c.name course, c.color, g.days, g.start_time, g.end_time, g.room, u.full_name teacher, e.monthly_fee fee
      from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id left join users u on u.id = g.teacher_id
      where e.student_id = ${sid} and e.active and e.end_date is null order by g.start_time`),
    db.execute<{ date: string; status: string }>(sql`select date::text, status::text from attendance where student_id = ${sid} and date >= ${addDays(t, -90)} order by date desc`),
    db.execute<{ s: number }>(sql`select coalesce(sum(amount), 0)::int s from coins where student_id = ${sid}`),
    db.execute<{ id: number; name: string; kind: string; start_date: string; end_date: string; lessons_total: number; used: number; status: string }>(sql`
      select ss.id, ss.name, ss.kind, ss.start_date::text, ss.end_date::text, ss.lessons_total, ss.status,
        (select count(*) from charges c where c.subscription_id = ss.id and c.kind = 'abonement_dars')::int used
      from student_subscriptions ss where ss.student_id = ${sid} and ss.status = 'faol' and ss.end_date >= ${t} order by ss.end_date`),
    db.execute<{ period: string; score: number; comment: string | null }>(sql`select period, score, comment from grades where student_id = ${sid} order by period desc, id desc limit 5`),
    db.execute<{ type: string; title: string; date: string; place: string | null }>(sql`select type, title, date::text, place from results where student_id = ${sid} order by date desc, id desc limit 6`),
  ]);
  const present = att.filter((a) => a.status === 'keldi' || a.status === 'kechikdi').length;
  return {
    balance,
    coins: coins[0]?.s ?? 0,
    groups: [...groups],
    next: nextLesson([...groups]),
    attendance: [...att],
    rate: att.length ? Math.round((present / att.length) * 100) : null,
    streak: (() => {
      let n = 0;
      for (const a of att) {
        if (a.status === 'keldi' || a.status === 'kechikdi') n++;
        else break;
      }
      return n;
    })(),
    subscriptions: subs.filter((s) => s.kind !== 'dars' || s.used < s.lessons_total),
    grades: [...grades],
    wins: [...wins],
  };
}

/** Eng yaqin dars (bugun hali boshlanmagan yoki keyingi kunlar) */
function nextLesson(groups: { name: string; course: string; color: string; days: string; start_time: string; end_time: string; room: string | null; teacher: string | null }[]) {
  const now = new Date();
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const t = today();
  for (let i = 0; i < 8; i++) {
    const d = addDays(t, i);
    const code = WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()];
    const todays = groups.filter((g) => g.days.split(',').includes(code) && (i > 0 || g.end_time > hm)).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (todays.length) return { ...todays[0], date: d, inDays: i, live: i === 0 && todays[0].start_time <= hm };
  }
  return null;
}

/** Hisob tarixi: yechimlar va to'lovlar (oxirgi 4 oy) */
export async function childLedger(sid: number) {
  const from = addDays(today(), -120);
  const [ch, pays] = await Promise.all([
    db.execute<{ id: number; date: string; kind: string; amount: number; note: string | null; grp: string | null }>(sql`
      select c.id, c.date::text, c.kind, c.amount, c.note, g.name grp from charges c left join groups g on g.id = c.group_id
      where c.student_id = ${sid} and c.date >= ${from} and c.date <= ${today()} and c.amount <> 0 order by c.date desc, c.id desc`),
    db.execute<{ id: number; date: string; amount: number; method: string }>(sql`
      select id, paid_at::text date, amount, method::text from payments where student_id = ${sid} and cancelled_at is null and paid_at >= ${from} order by paid_at desc, id desc`),
  ]);
  return [
    ...ch.map((c) => ({ key: 'c' + c.id, date: c.date, amount: -c.amount, title: c.kind === 'oylik' ? "Oylik to'lov" : c.kind === 'dars' ? 'Dars' : c.kind === 'abonement' ? 'Abonement' : c.amount < 0 ? 'Qaytarildi' : 'Tuzatish', sub: [c.grp, c.note].filter(Boolean).join(', ') })),
    ...pays.map((p) => ({ key: 'p' + p.id, date: p.date, amount: p.amount, title: "To'lov", sub: { naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme', bank: 'Bank' }[p.method] ?? p.method })),
  ].sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1));
}
