import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getSettings } from '@/lib/settings';
import { studentBalance } from '@/lib/finance';
import { clientIp, overLimit } from '@/lib/security';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtShort } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ota-ona kabineti', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

const ATT: Record<string, { l: string; c: string }> = {
  keldi: { l: 'Keldi', c: 'bg-good-soft text-good' },
  kechikdi: { l: 'Kechikdi', c: 'bg-warn-soft text-warn' },
  kelmadi: { l: 'Kelmadi', c: 'bg-bad-soft text-bad' },
  sababli: { l: 'Sababli', c: 'bg-info-soft text-info' },
};

/** Ota-ona uchun faqat o'qish rejimidagi kabinet: maxfiy havola orqali, parolsiz */
export default async function ParentCabinet({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) notFound();
  if (await overLimit('kabinet', await clientIp(), 120, 10)) notFound();
  const hash = createHash('sha256').update(token).digest('hex');
  const [s] = await db.execute<{ id: number; full_name: string; status: string; joined_at: string }>(sql`
    select id, full_name, status::text, joined_at::text from students where cabinet_hash = ${hash}`);
  if (!s) notFound();
  const [set, bal, groups, att, grades, coinRows, pays] = await Promise.all([
    getSettings(),
    studentBalance(s.id),
    db.execute<{ name: string; course: string; color: string; days: string; start_time: string; end_time: string; room: string | null; teacher: string | null; fee: number }>(sql`
      select g.name, c.name course, c.color, g.days, g.start_time, g.end_time, g.room, u.full_name teacher, e.monthly_fee fee
      from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id left join users u on u.id = g.teacher_id
      where e.student_id = ${s.id} and e.active and e.end_date is null`),
    db.execute<{ date: string; status: string; grp: string }>(sql`
      select a.date::text, a.status::text, g.name grp from attendance a join groups g on g.id = a.group_id where a.student_id = ${s.id} order by a.date desc limit 24`),
    db.execute<{ period: string; score: number; comment: string | null }>(sql`select period, score, comment from grades where student_id = ${s.id} order by period desc, id desc limit 6`),
    db.execute<{ amount: number; reason: string; d: string; total: number }>(sql`
      select amount, reason, (created_at at time zone 'Asia/Tashkent')::date::text d, sum(amount) over ()::int total from coins where student_id = ${s.id} order by id desc limit 8`),
    db.execute<{ amount: number; paid_at: string; method: string }>(sql`
      select amount, paid_at::text, method::text from payments where student_id = ${s.id} and cancelled_at is null order by paid_at desc, id desc limit 6`),
  ]);
  const coinTotal = coinRows[0]?.total ?? 0;
  const present = att.filter((a) => a.status === 'keldi' || a.status === 'kechikdi').length;
  return (
    <main className="min-h-screen bg-canvas pb-12">
      <header className="bg-ink px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-white/60">{set.centerName} · ota-ona kabineti</div>
          <h1 className="mt-1 text-2xl font-extrabold">{s.full_name}</h1>
          <p className="text-sm text-white/70">O&apos;qishni boshlagan: {fmtDate(s.joined_at)}</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="card px-3 py-3">
            <div className="text-xs font-semibold text-fg-muted">{bal < 0 ? 'Qarz' : 'Hisobda'}</div>
            <div className={`mt-1 text-lg font-extrabold tnum ${bal < 0 ? 'text-bad' : 'text-good'}`}>{money(Math.abs(bal))}</div>
          </div>
          <div className="card px-3 py-3">
            <div className="text-xs font-semibold text-fg-muted">Davomat</div>
            <div className="mt-1 text-lg font-extrabold tnum">{att.length ? `${Math.round((present / att.length) * 100)}%` : '—'}</div>
          </div>
          <div className="card px-3 py-3">
            <div className="text-xs font-semibold text-fg-muted">Coin</div>
            <div className="mt-1 text-lg font-extrabold tnum">{coinTotal}</div>
          </div>
        </div>
        {bal < 0 && set.payCard && (
          <div className="card px-4 py-3 text-sm">
            To&apos;lov uchun karta: <b className="tnum">{set.payCard.replace(/(\d{4})(?=\d)/g, '$1 ')}</b>
            {set.payCardHolder && <span className="text-fg-muted"> ({set.payCardHolder})</span>}
          </div>
        )}
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold">Guruhlar va dars vaqti</h2>
          {groups.length === 0 && <p className="px-4 py-4 text-sm text-fg-muted">Hozir guruhda emas.</p>}
          {groups.map((g) => (
            <div key={g.name} className="border-b border-line px-4 py-3 text-sm last:border-0">
              <div className="flex items-center gap-2 font-bold">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} /> {g.course}, {g.name}
              </div>
              <div className="mt-0.5 text-fg-muted">
                {g.days.split(',').join(', ')}, {g.start_time}–{g.end_time}
                {g.room && `, ${g.room}-xona`}
                {g.teacher && `. O'qituvchi: ${g.teacher}`}
              </div>
              <div className="text-fg-muted">Oylik to&apos;lov: {money(g.fee)}</div>
            </div>
          ))}
        </section>
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold">Oxirgi darslar</h2>
          {att.length === 0 ? (
            <p className="px-4 py-4 text-sm text-fg-muted">Hali davomat yo&apos;q.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {att.map((a, i) => (
                <span key={i} className={`rounded-md px-2 py-1 text-xs font-semibold ${ATT[a.status]?.c ?? ''}`} title={a.grp}>
                  {fmtShort(a.date)} {ATT[a.status]?.l}
                </span>
              ))}
            </div>
          )}
        </section>
        {grades.length > 0 && (
          <section className="card">
            <h2 className="border-b border-line px-4 py-3 text-sm font-bold">Baholar</h2>
            {grades.map((g, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span>
                  {g.period}
                  {g.comment && <span className="block text-xs text-fg-muted">{g.comment}</span>}
                </span>
                <b className="tnum">{g.score}</b>
              </div>
            ))}
          </section>
        )}
        <section className="card">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold">To&apos;lovlar</h2>
          {pays.length === 0 && <p className="px-4 py-4 text-sm text-fg-muted">Hali to&apos;lov yo&apos;q.</p>}
          {pays.map((p, i) => (
            <div key={i} className="flex justify-between border-b border-line px-4 py-2.5 text-sm last:border-0">
              <span className="text-fg-muted">{fmtDate(p.paid_at)}</span>
              <b className="tnum">{money(p.amount)}</b>
            </div>
          ))}
        </section>
        {coinRows.length > 0 && (
          <section className="card">
            <h2 className="border-b border-line px-4 py-3 text-sm font-bold">Coinlar</h2>
            {coinRows.map((c, i) => (
              <div key={i} className="flex justify-between border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span>
                  {c.reason} <span className="text-xs text-fg-muted">{fmtShort(c.d)}</span>
                </span>
                <b className={`tnum ${c.amount < 0 ? 'text-bad' : 'text-good'}`}>{c.amount > 0 ? `+${c.amount}` : c.amount}</b>
              </div>
            ))}
          </section>
        )}
        <p className="pt-2 text-center text-xs text-fg-muted">
          Savollar bo&apos;lsa: {set.phone ? <a href={`tel:+${set.phone}`} className="font-semibold text-brand">{phone(set.phone)}</a> : set.centerName}
          <br />
          Bu havolani boshqalarga bermang.
        </p>
      </div>
    </main>
  );
}
