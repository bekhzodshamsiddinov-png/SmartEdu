import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { PlayCircle, Gift, Smartphone, Infinity as InfinityIcon } from 'lucide-react';
import { db } from '@/db';
import { publishedCourses, curriculum } from '@/lib/academy';
import { getLearner } from '@/lib/learner';
import { getSettings } from '@/lib/settings';
import { CourseCard, hours } from '@/components/academy/course-card';
import { clickConfig, paymeConfig } from '@/lib/payments';

export default async function AcademyHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [courses, l, s] = await Promise.all([publishedCourses(), getLearner(), getSettings()]);
  const cat = ['ai', 'youtube'].includes(sp.yonalish) ? sp.yonalish : '';
  const list = courses.filter((c) => !cat || c.category === cat);
  const owned = l
    ? new Set((await db.execute<{ course_id: number }>(sql`select course_id from course_orders where learner_id = ${l.id} and status = 'tolandi'`)).map((r) => r.course_id))
    : new Set<number>();
  const featured = courses[0];
  const plan = featured ? (await curriculum(featured.id)).flatMap((m) => m.lessons.map((x) => ({ ...x, module: m.title }))).slice(0, 6) : [];
  const totalLessons = courses.reduce((a, c) => a + c.lessons, 0);
  const totalMin = courses.reduce((a, c) => a + c.minutes, 0);
  const payWays = [clickConfig() && 'Click', paymeConfig() && 'Payme', 'karta'].filter(Boolean).join(', ').replace(/, karta$/, ' yoki karta');
  const counts = { ai: courses.filter((c) => c.category === 'ai').length, youtube: courses.filter((c) => c.category === 'youtube').length };

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-sm font-bold text-[#7CE0C8]">{s.centerName} onlayn kurslari</p>
            <h1 className="mt-3 text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
              Sun&apos;iy intellekt va YouTube&apos;ni amalda o&apos;rganing
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/70">
              {s.academyTagline || "Qisqa video darslar va amaliy topshiriqlar. O'zingizga qulay vaqtda, telefon yoki kompyuterdan."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#kurslar" className="inline-flex h-12 items-center rounded-field bg-[#7CE0C8] px-6 text-[15px] font-extrabold text-ink hover:bg-white">
                Kurslarni ko&apos;rish
              </Link>
              {featured && featured.free > 0 && (
                <Link href={`/akademiya/kurs/${featured.slug}#dastur`} className="inline-flex h-12 items-center gap-2 rounded-field border border-white/25 px-6 text-[15px] font-bold text-white hover:bg-white/10">
                  <Gift className="h-4 w-4" /> Bepul darsni ko&apos;rish
                </Link>
              )}
            </div>
            {courses.length > 0 && (
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="text-xs font-semibold text-white/50">Kurslar</dt>
                  <dd className="text-2xl font-extrabold tnum">{courses.length}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-white/50">Video darslar</dt>
                  <dd className="text-2xl font-extrabold tnum">{totalLessons}</dd>
                </div>
                {totalMin > 0 && (
                  <div>
                    <dt className="text-xs font-semibold text-white/50">Umumiy davomiylik</dt>
                    <dd className="text-2xl font-extrabold">{hours(totalMin)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {featured && plan.length > 0 && (
            <Link href={`/akademiya/kurs/${featured.slug}`} className="block rounded-2xl border border-white/10 bg-white/[0.05] p-2 transition-colors hover:bg-white/[0.08]">
              <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white/50">Kurs dasturi</div>
                  <div className="truncate text-[15px] font-bold">{featured.title}</div>
                </div>
                <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: featured.color }} />
              </div>
              <ol className="space-y-1">
                {plan.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <span className="w-5 text-right text-xs font-bold text-white/40 tnum">{i + 1}</span>
                    <PlayCircle className="h-4 w-4 shrink-0 text-[#7CE0C8]" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    {p.isFree ? (
                      <span className="rounded-full bg-[#7CE0C8] px-2 py-0.5 text-[11px] font-extrabold text-ink">Bepul</span>
                    ) : (
                      p.durationMin && <span className="text-xs text-white/45 tnum">{p.durationMin} daq</span>
                    )}
                  </li>
                ))}
              </ol>
            </Link>
          )}
        </div>
      </section>

      <section id="kurslar" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-14 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">Kurslar</h2>
            <p className="mt-1 text-fg-muted">Har bir kursda video darslar, amaliy topshiriqlar va qo&apos;llab-quvvatlash.</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {[
              { k: '', l: 'Hammasi', n: courses.length },
              { k: 'ai', l: "Sun'iy intellekt", n: counts.ai },
              { k: 'youtube', l: 'YouTube', n: counts.youtube },
            ].map((t) => (
              <Link
                key={t.k}
                href={t.k ? `/akademiya?yonalish=${t.k}#kurslar` : '/akademiya#kurslar'}
                scroll={false}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold ${cat === t.k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted hover:text-fg'}`}
              >
                {t.l} <span className="text-xs opacity-60">{t.n}</span>
              </Link>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
            <div className="text-lg font-bold">Kurslar tez orada</div>
            <p className="mt-1 text-sm text-fg-muted">Yangi kurslar chiqqanda shu yerda paydo bo&apos;ladi.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <CourseCard key={c.id} c={c} owned={owned.has(c.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">Qanday o&apos;qiladi</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { t: "Kursni tanlang", d: "Dasturini ko'ring va bepul darslardan boshlang." },
            { t: "To'lov qiling", d: `${payWays[0].toUpperCase()}${payWays.slice(1)} orqali. To'lov tasdiqlangach kurs ochiladi.` },
            { t: "O'qing va bajaring", d: "Darslarni o'z tempingizda ko'ring, topshiriqlarni bajaring, natijangizni kuzating." },
          ].map((x, i) => (
            <li key={x.t} className="rounded-2xl border border-line bg-white p-6">
              <span className="text-sm font-extrabold text-brand tnum">{i + 1}-qadam</span>
              <h3 className="mt-2 text-lg font-extrabold">{x.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{x.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-3 rounded-2xl bg-brand-soft p-6 text-sm sm:grid-cols-2">
          <span className="flex items-center gap-2.5 font-semibold text-brand-strong">
            <Smartphone className="h-5 w-5" /> Telefon, planshet va kompyuterda ishlaydi
          </span>
          <span className="flex items-center gap-2.5 font-semibold text-brand-strong">
            <InfinityIcon className="h-5 w-5" /> Darslarni xohlagancha qayta ko&apos;rish mumkin
          </span>
        </div>
      </section>
    </>
  );
}
