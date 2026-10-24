import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { PlayCircle } from 'lucide-react';
import { db } from '@/db';
import { requireLearner } from '@/lib/learner';
import { money, phone } from '@/lib/format';
import { fmtDate } from '@/lib/dates';
import { logoutLearner } from '@/app/actions/academy';
import { ProfileForm } from './profile';

export const metadata = { title: 'Kabinet' };

export default async function Cabinet() {
  const l = await requireLearner('/akademiya/kabinet');
  const [mine, pending, me] = await Promise.all([
    db.execute<{ id: number; slug: string; title: string; color: string; access_until: string | null; total: number; done: number; last: string | null }>(sql`
      select c.id, c.slug, c.title, c.color, max(o.access_until)::text access_until,
        (select count(*) from course_lessons cl where cl.course_id = c.id and cl.published)::int total,
        (select count(*) from lesson_progress p join course_lessons cl on cl.id = p.lesson_id where p.learner_id = ${l.id} and cl.course_id = c.id and cl.published)::int done,
        (select max(p.completed_at)::text from lesson_progress p join course_lessons cl on cl.id = p.lesson_id where p.learner_id = ${l.id} and cl.course_id = c.id) last
      from course_orders o join online_courses c on c.id = o.course_id
      where o.learner_id = ${l.id} and o.status = 'tolandi' and (o.access_until is null or o.access_until >= current_date)
      group by c.id order by last desc nulls last`),
    db.execute<{ id: number; title: string; amount: number; created: string }>(sql`
      select o.id, c.title, o.amount, o.created_at::date::text created from course_orders o join online_courses c on c.id = o.course_id
      where o.learner_id = ${l.id} and o.status = 'kutilmoqda' order by o.id desc`),
    db.execute<{ email: string | null; telegram: string | null }>(sql`select email, telegram from learners where id = ${l.id}`),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg-muted tnum">{phone(l.phone)}</p>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">Salom, {l.fullName.split(' ')[0]}</h1>
        </div>
        <form action={logoutLearner}>
          <button className="text-sm font-bold text-fg-muted hover:text-bad">Chiqish</button>
        </form>
      </div>

      {pending.length > 0 && (
        <div className="mt-6 space-y-2">
          {pending.map((p) => (
            <Link key={p.id} href={`/akademiya/tolov/${p.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-5 py-4">
              <div>
                <div className="text-sm font-bold">{p.title}</div>
                <div className="text-xs text-fg-muted">To&apos;lov kutilmoqda, {money(p.amount)}</div>
              </div>
              <span className="rounded-field bg-ink px-4 py-2 text-sm font-bold text-white">To&apos;lash</span>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-xl font-extrabold">Mening kurslarim</h2>
      {mine.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-12 text-center">
          <div className="font-bold">Hali kurs yo&apos;q</div>
          <p className="mt-1 text-sm text-fg-muted">Kurslar ro&apos;yxatidan o&apos;zingizga mosini tanlang.</p>
          <Link href="/akademiya#kurslar" className="mt-4 inline-flex h-11 items-center rounded-field bg-brand px-5 text-sm font-bold text-white">
            Kurslarni ko&apos;rish
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {mine.map((c) => {
            const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <Link key={c.id} href={`/akademiya/oqish/${c.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-pop">
                <div className="h-2" style={{ background: c.color }} />
                <div className="p-5">
                  <div className="text-[17px] font-extrabold group-hover:text-brand">{c.title}</div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-fg-muted">
                      {c.done} / {c.total} dars
                    </span>
                    <span className="font-extrabold tnum">{pct}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-fg-muted">{c.access_until ? `Kirish ${fmtDate(c.access_until)} gacha` : 'Umrbod kirish'}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                      <PlayCircle className="h-4 w-4" /> {pct === 0 ? 'Boshlash' : pct === 100 ? "Qayta ko'rish" : 'Davom etish'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="mt-12 text-xl font-extrabold">Profil</h2>
      <div className="mt-4 rounded-2xl border border-line bg-white p-6">
        <ProfileForm name={l.fullName} email={me[0]?.email ?? ''} telegram={me[0]?.telegram ?? ''} />
      </div>
    </div>
  );
}
