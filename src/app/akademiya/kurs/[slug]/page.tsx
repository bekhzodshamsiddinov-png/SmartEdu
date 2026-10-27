import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { CheckCircle2, PlayCircle, FileText, ListChecks, Wrench, Gift, Lock, Clock3, Infinity as InfinityIcon, CalendarDays, BarChart } from 'lucide-react';
import { db } from '@/db';
import { courseBySlug, curriculum, hasAccess, CATEGORIES } from '@/lib/academy';
import { getLearner } from '@/lib/learner';
import { money } from '@/lib/format';
import { hours } from '@/components/academy/course-card';
import { BuyBox } from './buy-box';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { organizationLd, isoDuration } from '@/lib/seo';
import { siteUrl } from '@/lib/payments';

const KIND_ICON = { video: PlayCircle, matn: FileText, test: ListChecks, topshiriq: Wrench } as const;
const LVL: Record<string, string> = { boshlangich: "Boshlang'ich", orta: "O'rta", yuqori: 'Yuqori' };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await courseBySlug((await params).slug);
  if (!c || c.status === 'qoralama') return { robots: { index: false } };
  const description = (c.subtitle || c.description || c.title).slice(0, 160);
  const url = `/akademiya/kurs/${c.slug}`;
  return {
    title: c.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: c.title, description, url, ...(c.coverUrl?.startsWith('https://') ? { images: [{ url: c.coverUrl }] } : {}) },
    twitter: { card: 'summary_large_image', title: c.title, description },
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await courseBySlug(slug);
  if (!c || c.status === 'qoralama') notFound();
  const [mods, l] = await Promise.all([curriculum(c.id), getLearner()]);
  const access = await hasAccess(l?.id, c.id);
  const [pending] = l
    ? await db.execute<{ id: number }>(sql`select id from course_orders where learner_id = ${l.id} and course_id = ${c.id} and status = 'kutilmoqda' order by id desc limit 1`)
    : [];
  const lessons = mods.flatMap((m) => m.lessons);
  const site = siteUrl();
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: c.title,
      description: (c.subtitle || c.description || c.title).slice(0, 500),
      url: `${site}/akademiya/kurs/${c.slug}`,
      inLanguage: 'uz',
      ...(c.coverUrl?.startsWith('https://') ? { image: c.coverUrl } : {}),
      provider: { '@id': `${site}/akademiya#org` },
      educationalLevel: c.level === 'boshlangich' ? 'Beginner' : c.level,
      offers: { '@type': 'Offer', price: c.price, priceCurrency: 'UZS', availability: 'https://schema.org/InStock', category: c.price ? 'Paid' : 'Free', url: `${site}/akademiya/kurs/${c.slug}` },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Online',
        courseWorkload: isoDuration(lessons.reduce((a, x) => a + (x.durationMin ?? 0), 0)),
      },
      syllabusSections: mods.map((m) => ({ '@type': 'Syllabus', name: m.title, description: m.lessons.map((x) => x.title).join(', ').slice(0, 300) })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Akademiya', item: `${site}/akademiya` },
        { '@type': 'ListItem', position: 2, name: c.title, item: `${site}/akademiya/kurs/${c.slug}` },
      ],
    },
    await organizationLd(),
  ];
  const minutes = lessons.reduce((a, x) => a + (x.durationMin ?? 0), 0);
  const free = lessons.filter((x) => x.isFree);
  const outcomes = (c.outcomes ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const audience = (c.audience ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const off = c.oldPrice && c.oldPrice > c.price ? Math.round((1 - c.price / c.oldPrice) * 100) : 0;
  const closed = c.status === 'yopiq';

  const facts = [
    { i: PlayCircle, t: `${lessons.length} ta dars` },
    hours(minutes) && { i: Clock3, t: hours(minutes)! },
    { i: BarChart, t: `${LVL[c.level] ?? c.level} daraja` },
    c.accessDays ? { i: CalendarDays, t: `${c.accessDays} kunlik kirish` } : { i: InfinityIcon, t: 'Umrbod kirish' },
  ].filter(Boolean) as { i: typeof PlayCircle; t: string }[];

  return (
    <>
      <JsonLd data={ld} />
    <>
      <section className="text-white" style={{ background: `linear-gradient(180deg, #0F2A2E 0%, #0F2A2E 70%, ${c.color} 140%)` }}>
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:pb-16 lg:pr-[420px]">
          <Link href="/akademiya#kurslar" className="text-sm font-semibold text-white/60 hover:text-white">
            Kurslar
          </Link>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full px-3 py-1" style={{ background: c.color }}>
              {CATEGORIES[c.category] ?? c.category}
            </span>
            {free.length > 0 && <span className="rounded-full bg-[#7CE0C8] px-3 py-1 text-ink">{free.length} ta bepul dars</span>}
          </div>
          <h1 className="mt-4 text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[44px]">{c.title}</h1>
          {c.subtitle && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/75">{c.subtitle}</p>}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {facts.map((f) => (
              <li key={f.t} className="inline-flex items-center gap-2">
                <f.i className="h-4 w-4 text-[#7CE0C8]" /> {f.t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 space-y-10 pt-10 lg:order-1">
          {outcomes.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
              <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Nimalarni o&apos;rganasiz</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {outcomes.map((o) => (
                  <li key={o} className="flex gap-3 text-[15px] leading-snug">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="dastur" className="scroll-mt-24">
            <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Kurs dasturi</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {mods.length} modul, {lessons.length} dars{hours(minutes) ? `, ${hours(minutes)}` : ''}
            </p>
            <div className="mt-5 space-y-3">
              {mods.map((m, mi) => (
                <details key={m.id} open={mi === 0} className="group overflow-hidden rounded-2xl border border-line bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas text-sm font-extrabold tnum">{mi + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{m.title}</span>
                      <span className="text-xs text-fg-muted">
                        {m.lessons.length} dars{hours(m.lessons.reduce((a, x) => a + (x.durationMin ?? 0), 0)) ? `, ${hours(m.lessons.reduce((a, x) => a + (x.durationMin ?? 0), 0))}` : ''}
                      </span>
                    </span>
                    <span className="text-xl text-fg-faint transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <ul className="divide-y divide-line border-t border-line">
                    {m.lessons.map((x) => {
                      const I = KIND_ICON[x.kind as keyof typeof KIND_ICON] ?? PlayCircle;
                      const open = access || x.isFree;
                      const inner = (
                        <>
                          <I className={`h-4 w-4 shrink-0 ${open ? 'text-brand' : 'text-fg-faint'}`} />
                          <span className="min-w-0 flex-1 truncate text-sm">{x.title}</span>
                          {x.isFree && !access && <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-bold text-info">Bepul ko&apos;rish</span>}
                          {x.durationMin ? <span className="text-xs text-fg-muted tnum">{x.durationMin} daq</span> : null}
                          {!open && <Lock className="h-3.5 w-3.5 text-fg-faint" />}
                        </>
                      );
                      return (
                        <li key={x.id}>
                          {open ? (
                            <Link href={`/akademiya/oqish/${c.slug}/${x.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                              {inner}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-5 py-3">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
              {mods.length === 0 && <p className="rounded-2xl border border-line bg-white p-6 text-sm text-fg-muted">Dastur tez orada e&apos;lon qilinadi.</p>}
            </div>
          </section>

          {audience.length > 0 && (
            <section>
              <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Kurs kimlar uchun</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {audience.map((a) => (
                  <li key={a} className="rounded-2xl border border-line bg-white p-5 text-[15px] font-semibold leading-snug">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.description && (
            <section>
              <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Kurs haqida</h2>
              <div className="mt-4 max-w-[68ch] whitespace-pre-wrap text-[15px] leading-[1.75] text-fg">{c.description}</div>
            </section>
          )}
        </div>

        <aside className="order-1 lg:order-2">
          <div className="-mt-6 lg:sticky lg:top-24 lg:-mt-48">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
              <div className="h-2" style={{ background: c.color }} />
              <div className="p-6">
                {access ? (
                  <>
                    <div className="text-lg font-extrabold text-good">Kurs sizda ochiq</div>
                    <p className="mt-1 text-sm text-fg-muted">Qolgan joydan davom eting.</p>
                    <Link href={`/akademiya/oqish/${c.slug}`} className="mt-5 flex h-12 items-center justify-center rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong">
                      O&apos;qishni davom ettirish
                    </Link>
                  </>
                ) : closed ? (
                  <>
                    <div className="text-lg font-extrabold">Sotuv yopilgan</div>
                    <p className="mt-1 text-sm text-fg-muted">Keyingi oqim haqida bilish uchun biz bilan bog&apos;laning.</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-end gap-3">
                      <span className="text-[32px] font-extrabold leading-none tracking-[-0.02em] tnum">{c.price ? money(c.price) : 'Bepul'}</span>
                      {off > 0 && <span className="pb-1 text-fg-faint line-through tnum">{money(c.oldPrice!)}</span>}
                    </div>
                    {off > 0 && <div className="mt-2 inline-block rounded-md bg-bad-soft px-2 py-0.5 text-xs font-extrabold text-bad">−{off}% chegirma</div>}
                    <BuyBox courseId={c.id} price={c.price} loggedIn={!!l} slug={c.slug} pendingOrder={pending?.id ?? null} />
                  </>
                )}
                <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
                  {facts.map((f) => (
                    <li key={f.t} className="flex items-center gap-2.5 text-fg-muted">
                      <f.i className="h-4 w-4 text-brand" /> {f.t}
                    </li>
                  ))}
                  {free.length > 0 && !access && (
                    <li>
                      <Link href={`/akademiya/oqish/${c.slug}/${free[0].id}`} className="flex items-center gap-2.5 font-bold text-info hover:underline">
                        <Gift className="h-4 w-4" /> Bepul darsni hozir ko&apos;rish
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
    </>
  );
}
