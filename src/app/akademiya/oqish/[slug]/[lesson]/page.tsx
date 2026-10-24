import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { ArrowLeft, ArrowRight, Lock, PlayCircle, FileText, ListChecks, Wrench, CheckCircle2 } from 'lucide-react';
import { db } from '@/db';
import { courseBySlug, curriculum, embedOf, hasAccess } from '@/lib/academy';
import { getLearner } from '@/lib/learner';
import { CompleteToggle, MobileOutline, Watermark } from './client';

const KIND_ICON = { video: PlayCircle, matn: FileText, test: ListChecks, topshiriq: Wrench } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const { slug } = await params;
  const c = await courseBySlug(slug);
  return { title: c?.title ?? 'Dars', robots: { index: false } };
}

export default async function Player({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const { slug, lesson } = await params;
  const c = await courseBySlug(slug);
  if (!c) notFound();
  const mods = await curriculum(c.id);
  const all = mods.flatMap((m) => m.lessons);
  const idx = all.findIndex((x) => x.id === Number(lesson));
  if (idx < 0) notFound();
  const cur = all[idx];
  const l = await getLearner();
  const access = await hasAccess(l?.id, c.id);
  // Sotuvga chiqmagan kursning bepul darslari ham yopiq
  if (!access && c.status === 'qoralama') notFound();
  if (!access && !cur.isFree) redirect(l ? `/akademiya/kurs/${slug}` : `/akademiya/kirish?next=${encodeURIComponent(`/akademiya/oqish/${slug}/${cur.id}`)}`);
  const done = new Set(
    l ? (await db.execute<{ lesson_id: number }>(sql`select lesson_id from lesson_progress where learner_id = ${l.id}`)).map((r) => r.lesson_id) : [],
  );
  const doneCount = all.filter((x) => done.has(x.id)).length;
  const prev = all[idx - 1];
  const next = all[idx + 1];
  const canOpen = (x: (typeof all)[number]) => access || x.isFree;
  const embed = cur.kind === 'video' ? embedOf(cur.videoUrl) : null;
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;

  const outline = (
    <nav aria-label="Kurs dasturi" className="space-y-4">
      {mods.map((m, mi) => (
        <div key={m.id}>
          <div className="px-3 pb-1.5 text-xs font-bold text-fg-muted">
            {mi + 1}. {m.title.replace(/^\d+-modul\.\s*/i, '')}
          </div>
          <ul>
            {m.lessons.map((x) => {
              const I = KIND_ICON[x.kind as keyof typeof KIND_ICON] ?? PlayCircle;
              const on = x.id === cur.id;
              const ok = canOpen(x);
              const body = (
                <>
                  {done.has(x.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-good" /> : ok ? <I className={`h-4 w-4 shrink-0 ${on ? 'text-white' : 'text-brand'}`} /> : <Lock className="h-4 w-4 shrink-0 text-fg-faint" />}
                  <span className="min-w-0 flex-1 truncate">{x.title}</span>
                  {x.durationMin ? <span className={`text-xs tnum ${on ? 'text-white/70' : 'text-fg-faint'}`}>{x.durationMin}</span> : null}
                </>
              );
              return (
                <li key={x.id}>
                  {ok ? (
                    <Link href={`/akademiya/oqish/${slug}/${x.id}`} aria-current={on ? 'page' : undefined} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${on ? 'bg-ink text-white' : 'hover:bg-canvas'}`}>
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-fg-faint">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
      <div>
        <Link href={`/akademiya/kurs/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> {c.title}
        </Link>
        <div className="mt-3 overflow-hidden rounded-2xl bg-ink">
          {embed ? (
            embed.kind === 'iframe' ? (
              <div className="relative aspect-video">
                {l && access && <Watermark text={`${l.fullName} · +${l.phone}`} />}
                <iframe src={embed.src} title={cur.title} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
              </div>
            ) : (
              <div className="relative">
                {l && access && <Watermark text={`${l.fullName} · +${l.phone}`} />}
                <video src={embed.src} controls controlsList="nodownload noplaybackrate" disablePictureInPicture className="aspect-video w-full" />
              </div>
            )
          ) : (
            <div className="grid aspect-[16/6] place-items-center px-6 text-center text-white">
              <div>
                {(() => {
                  const I = KIND_ICON[cur.kind as keyof typeof KIND_ICON] ?? FileText;
                  return <I className="mx-auto h-10 w-10 text-[#7CE0C8]" />;
                })()}
                <div className="mt-3 text-sm font-semibold text-white/70">{cur.kind === 'video' ? 'Video tez orada qo\'shiladi' : cur.kind === 'test' ? 'Test' : cur.kind === 'topshiriq' ? 'Amaliy topshiriq' : 'Matnli dars'}</div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-fg-muted tnum">
              {idx + 1}-dars, {all.length} tadan
            </p>
            <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{cur.title}</h1>
          </div>
          {access && <CompleteToggle lessonId={cur.id} done={done.has(cur.id)} nextHref={next ? `/akademiya/oqish/${slug}/${next.id}` : null} />}
        </div>
        {!access && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-extrabold text-brand-strong">Bu bepul dars</div>
              <div className="text-sm text-fg-muted">Qolgan {all.length - all.filter((x) => x.isFree).length} ta darsni ko&apos;rish uchun kursni oching.</div>
            </div>
            <Link href={`/akademiya/kurs/${slug}`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-field bg-brand px-5 text-sm font-extrabold text-white">
              Kursni ochish
            </Link>
          </div>
        )}
        {cur.content && <div className="mt-6 max-w-[72ch] whitespace-pre-wrap rounded-2xl border border-line bg-white p-6 text-[15px] leading-[1.75]">{cur.content}</div>}
        <div className="mt-6 flex items-center justify-between gap-3">
          {prev && canOpen(prev) ? (
            <Link href={`/akademiya/oqish/${slug}/${prev.id}`} className="inline-flex h-11 items-center gap-2 rounded-field border border-line-strong bg-white px-4 text-sm font-bold">
              <ArrowLeft className="h-4 w-4" /> Oldingi
            </Link>
          ) : (
            <span />
          )}
          {next && canOpen(next) && (
            <Link href={`/akademiya/oqish/${slug}/${next.id}`} className="inline-flex h-11 items-center gap-2 rounded-field bg-ink px-4 text-sm font-bold text-white">
              Keyingi dars <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="mt-6 lg:hidden">
          <MobileOutline label={`Kurs dasturi, ${pct}% tugatildi`}>{outline}</MobileOutline>
        </div>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-line bg-white p-3">
          {access && (
            <div className="mb-4 px-3 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Jarayon</span>
                <span className="tnum">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {outline}
        </div>
      </aside>
    </div>
  );
}
