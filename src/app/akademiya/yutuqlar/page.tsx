import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { Medal, Trophy } from 'lucide-react';
import { db } from '@/db';
import { getSettings } from '@/lib/settings';
import { JsonLd } from '@/components/json-ld';
import { siteUrl } from '@/lib/payments';
import { RESULT_LEVELS, RESULT_META, RESULT_PLACES } from '@/lib/constants';
import { fmtDate } from '@/lib/dates';

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = `${s.centerName} o'quvchilarining haqiqiy natijalari: musobaqalardagi o'rinlar, Play Market'dagi ilovalar, sotilgan loyihalar va ishga kirganlar.`;
  return {
    title: { absolute: `O'quvchilarimiz yutuqlari — ${s.centerName}` },
    description,
    alternates: { canonical: '/akademiya/yutuqlar' },
    openGraph: { title: `O'quvchilarimiz yutuqlari — ${s.centerName}`, description, url: '/akademiya/yutuqlar', type: 'website' },
  };
}

/** Ism-familiya o'rniga "Ism F." — shaxsiy ma'lumot ochiq saytga chiqmaydi */
const shortName = (n: string) => {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b[0].toUpperCase()}.` : a;
};

export default async function PublicAchievements() {
  const s = await getSettings();
  const rows = await db.execute<{ id: number; type: string; title: string; date: string; place: string | null; level: string | null; link: string | null; name: string; course: string | null }>(sql`
    select r.id, r.type, r.title, r.date::text, r.place, r.level, r.link, st.full_name name,
      (select c.name from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = st.id order by e.start_date desc limit 1) course
    from results r join students st on st.id = r.student_id
    where r.is_public order by r.date desc limit 120`);
  const prizes = rows.filter((r) => ['1', '2', '3'].includes(r.place ?? '')).length;
  const apps = rows.filter((r) => r.type === 'Play Market ilova').length;
  const jobs = rows.filter((r) => r.type === 'Ishga kirdi').length;
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${s.centerName} o'quvchilari yutuqlari`,
          url: `${siteUrl()}/akademiya/yutuqlar`,
          numberOfItems: rows.length,
          itemListElement: rows.slice(0, 30).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `${shortName(r.name)}: ${r.title}` })),
        }}
      />
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#7CE0C8]">
            <Trophy className="h-3.5 w-3.5" /> Haqiqiy natijalar
          </span>
          <h1 className="mt-4 max-w-2xl text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">O&apos;quvchilarimiz nimalarga erishdi</h1>
          <p className="mt-3 max-w-xl text-white/70">Musobaqalardagi o&apos;rinlar, Play Market&apos;ga chiqqan ilovalar, sotilgan loyihalar va ishga kirganlar. Har biri o&apos;quvchi va ota-ona roziligi bilan.</p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              { v: prizes, l: "sovrinli o'rin" },
              { v: apps, l: 'ilova Play Market’da' },
              { v: jobs, l: 'ishga kirdi' },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-white/[0.06] p-4">
                <div className="text-3xl font-extrabold text-[#7CE0C8] tnum">{x.v}</div>
                <div className="text-xs font-semibold text-white/60">{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-8 text-center text-fg-muted">Tez orada shu yerda o&apos;quvchilarimiz yutuqlari paydo bo&apos;ladi.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: RESULT_META[r.type]?.color ?? '#8C9A97' }}>
                  <Medal className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-fg-muted">{r.type}</div>
                  <div className="mt-0.5 font-bold leading-snug">{r.title}</div>
                  <div className="mt-1 text-[13px] text-fg-muted">
                    {shortName(r.name)}
                    {r.course ? `, ${r.course}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {RESULT_PLACES.find((p) => p.k === r.place) && <span className="rounded-full bg-good-soft px-2 py-0.5 font-bold text-good">{RESULT_PLACES.find((p) => p.k === r.place)!.l}</span>}
                    {RESULT_LEVELS.find((p) => p.k === r.level) && <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold text-fg-muted">{RESULT_LEVELS.find((p) => p.k === r.level)!.l}</span>}
                    <span className="text-fg-faint">{fmtDate(r.date)}</span>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-bold text-brand hover:underline">
                        Ko&apos;rish
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 rounded-2xl bg-brand-soft p-6 text-center">
          <div className="text-lg font-extrabold">Farzandingiz ham shunday natijaga erishsin</div>
          <Link href="/akademiya/ariza" className="mt-4 inline-flex h-11 items-center rounded-field bg-brand px-6 font-bold text-white hover:bg-brand-strong">
            Bepul sinov darsiga yozilish
          </Link>
        </div>
      </section>
    </>
  );
}
