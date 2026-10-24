'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2, Plus, PlayCircle, FileText, ListChecks, Wrench, Eye, EyeOff, ExternalLink, Rocket, Archive, Undo2, Gift,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { CourseForm, type CourseData } from '@/components/online/course-form';
import { deleteLesson, deleteModule, deleteOnlineCourse, moveLesson, moveModule, saveLesson, saveModule, setCourseStatus } from '@/app/actions/online';
import { COURSE_STATUS, LESSON_KINDS, LEVELS } from '@/lib/constants';
import { money, phone } from '@/lib/format';
import { fmtShort } from '@/lib/dates';

type Lesson = { id: number; title: string; kind: string; videoUrl: string | null; durationMin: number | null; content: string | null; isFree: boolean; published: boolean; position: number };
type Mod = { id: number; title: string; position: number; lessons: Lesson[] };

const KIND_ICON: Record<string, typeof PlayCircle> = { video: PlayCircle, matn: FileText, test: ListChecks, topshiriq: Wrench };

function dur(min: number) {
  if (!min) return '0 daq';
  const h = Math.floor(min / 60);
  return h ? `${h} soat ${min % 60} daq` : `${min} daq`;
}

export function CourseEditor({
  course,
  modules,
  stats,
  buyers,
  canEdit,
  isBoss,
}: {
  course: CourseData & { createdAt: string; updatedAt: string };
  modules: Mod[];
  stats: { sales: number; revenue: number; pending: number };
  buyers: { id: number; name: string; phone: string; paid_at: string | null; done: number }[];
  canEdit: boolean;
  isBoss: boolean;
}) {
  const router = useRouter();
  const [mod, setMod] = useState<Mod | 'new' | null>(null);
  const [lesson, setLesson] = useState<{ moduleId: number; l?: Lesson } | null>(null);
  const [settings, setSettings] = useState(false);
  const all = modules.flatMap((m) => m.lessons);
  const minutes = all.reduce((s, l) => s + (l.durationMin ?? 0), 0);
  const free = all.filter((l) => l.isFree).length;
  const noVideo = all.filter((l) => l.kind === 'video' && !l.videoUrl).length;
  const st = COURSE_STATUS[course.status];

  return (
    <>
      <Link href="/onlayn/kurslar" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Kurslar
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 h-12 w-12 shrink-0 rounded-xl" style={{ background: course.color }} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{course.title}</h1>
              <Badge tone={st?.tone ?? 'neutral'} dot>
                {st?.label ?? course.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {LEVELS[course.level]}, {money(course.price)}
              {course.accessDays ? `, ${course.accessDays} kunlik kirish` : ', umrbod kirish'}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSettings(true)}>
              <Pencil className="h-4 w-4" /> Sozlamalar
            </Button>
            {course.status !== 'sotuvda' ? (
              <ActionButton variant="primary" size="md" action={() => setCourseStatus(course.id, 'sotuvda')}>
                <Rocket className="h-4 w-4" /> Sotuvga chiqarish
              </ActionButton>
            ) : (
              <>
                <ActionButton size="md" action={() => setCourseStatus(course.id, 'qoralama')} confirm="Kurs sotuvdan olinib, qoralamaga qaytarilsinmi?">
                  <Undo2 className="h-4 w-4" /> Qoralamaga
                </ActionButton>
                <ActionButton size="md" action={() => setCourseStatus(course.id, 'yopiq')} confirm="Kurs yopilsinmi? Yangi sotuv bo'lmaydi, eski o'quvchilar kirishda davom etadi.">
                  <Archive className="h-4 w-4" /> Yopish
                </ActionButton>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Kurs dasturi</h2>
              <p className="text-[13px] text-fg-muted">
                {modules.length} modul, {all.length} dars, {dur(minutes)}
              </p>
            </div>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setMod('new')}>
                <Plus className="h-4 w-4" /> Modul
              </Button>
            )}
          </div>
          {noVideo > 0 && (
            <p className="rounded-field bg-warn-soft px-3 py-2.5 text-[13px] font-semibold text-warn">{noVideo} ta video darsga hali video havolasi qo&apos;yilmagan.</p>
          )}

          {modules.map((m, mi) => {
            const mMin = m.lessons.reduce((s, l) => s + (l.durationMin ?? 0), 0);
            return (
              <Card key={m.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line bg-canvas/60 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold tnum">{mi + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-bold">{m.title}</h3>
                    <p className="text-xs text-fg-muted">
                      {m.lessons.length} dars, {dur(mMin)}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center">
                      <ActionButton variant="ghost" size="icon" action={() => moveModule(m.id, -1)} title="Yuqoriga">
                        <ArrowUp className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton variant="ghost" size="icon" action={() => moveModule(m.id, 1)} title="Pastga">
                        <ArrowDown className="h-4 w-4" />
                      </ActionButton>
                      <Button variant="ghost" size="icon" onClick={() => setMod(m)} aria-label="Modulni tahrirlash">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ActionButton variant="ghost" size="icon" action={() => deleteModule(m.id)} confirm={`"${m.title}" moduli va ichidagi ${m.lessons.length} ta dars o'chirilsinmi?`} title="Modulni o'chirish">
                        <Trash2 className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-line">
                  {m.lessons.map((l, li) => {
                    const I = KIND_ICON[l.kind] ?? PlayCircle;
                    return (
                      <li key={l.id} className={cn('group flex items-center gap-3 px-4 py-2.5', !l.published && 'opacity-60')}>
                        <span className="w-8 shrink-0 text-right text-xs font-bold text-fg-faint tnum">
                          {mi + 1}.{li + 1}
                        </span>
                        <I className={cn('h-4 w-4 shrink-0', l.kind === 'video' && !l.videoUrl ? 'text-warn' : 'text-brand')} />
                        <button onClick={() => canEdit && setLesson({ moduleId: m.id, l })} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-semibold hover:text-brand">{l.title}</span>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                            {LESSON_KINDS[l.kind] ?? l.kind}
                            {l.durationMin ? <span>{l.durationMin} daq</span> : null}
                            {l.kind === 'video' && !l.videoUrl && <span className="font-semibold text-warn">video yo&apos;q</span>}
                          </span>
                        </button>
                        {l.isFree && (
                          <Badge tone="info">
                            <Gift className="h-3 w-3" /> Bepul
                          </Badge>
                        )}
                        {!l.published && (
                          <Badge>
                            <EyeOff className="h-3 w-3" /> Yashirin
                          </Badge>
                        )}
                        {l.videoUrl && (
                          <a href={l.videoUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-canvas" aria-label="Videoni ochish">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {canEdit && (
                          <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <ActionButton variant="ghost" size="icon" action={() => moveLesson(l.id, -1)} title="Yuqoriga">
                              <ArrowUp className="h-4 w-4" />
                            </ActionButton>
                            <ActionButton variant="ghost" size="icon" action={() => moveLesson(l.id, 1)} title="Pastga">
                              <ArrowDown className="h-4 w-4" />
                            </ActionButton>
                            <ActionButton variant="ghost" size="icon" action={() => deleteLesson(l.id)} confirm={`"${l.title}" darsi o'chirilsinmi?`} title="Darsni o'chirish">
                              <Trash2 className="h-4 w-4" />
                            </ActionButton>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {canEdit && (
                    <li>
                      <button onClick={() => setLesson({ moduleId: m.id })} className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-bold text-brand hover:bg-brand-soft/50">
                        <Plus className="h-4 w-4" /> Dars qo&apos;shish
                      </button>
                    </li>
                  )}
                </ul>
              </Card>
            );
          })}
          {modules.length === 0 && (
            <Card className="p-8 text-center text-sm text-fg-muted">
              Kurs dasturi bo&apos;sh. Avval modul qo&apos;shing (masalan, &quot;1-modul. Kirish&quot;), keyin unga darslar qo&apos;shing.
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <Mini label="Sotuvlar" value={String(stats.sales)} />
              <Mini label="Tushum" value={money(stats.revenue, false)} />
              <Mini label="Darslar" value={String(all.length)} />
              <Mini label="Bepul darslar" value={String(free)} />
            </div>
            {stats.pending > 0 && (
              <Link href="/onlayn/sotuvlar?holat=kutilmoqda" className="mt-4 block rounded-field bg-warn-soft px-3 py-2 text-[13px] font-semibold text-warn">
                {stats.pending} ta buyurtma to&apos;lovni kutmoqda
              </Link>
            )}
            <Link href={`/onlayn/sotuvlar?yangi=1&kurs=${course.id}`} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-field bg-brand text-sm font-bold text-white hover:bg-brand-strong">
              <Plus className="h-4 w-4" /> Sotuv qo&apos;shish
            </Link>
          </Card>

          {course.subtitle || course.description ? (
            <Card className="p-5">
              <h3 className="text-sm font-bold">Tavsif</h3>
              {course.subtitle && <p className="mt-1.5 text-sm font-semibold">{course.subtitle}</p>}
              {course.description && <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-[13px] text-fg-muted">{course.description}</p>}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Oxirgi o'quvchilar" />
            {buyers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-fg-muted">Hali sotib olgan yo&apos;q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {buyers.map((b) => (
                  <li key={b.id} className="px-5 py-2.5">
                    <div className="flex justify-between gap-3">
                      <Link href={`/onlayn/oquvchilar?id=${b.id}`} className="truncate text-sm font-bold hover:text-brand">
                        {b.name}
                      </Link>
                      <span className="shrink-0 text-xs text-fg-muted">{fmtShort(b.paid_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-fg-muted tnum">
                      {phone(b.phone)}
                      {all.length > 0 && `, ${Math.round((b.done / all.length) * 100)}% o'tdi`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {isBoss && (
            <div className="text-right">
              <ActionButton
                variant="ghost"
                action={async () => {
                  const r = await deleteOnlineCourse(course.id);
                  if (r.ok) router.push('/onlayn/kurslar');
                  return r;
                }}
                confirm="Kurs butunlay o'chirilsinmi?"
              >
                <Trash2 className="h-4 w-4" /> Kursni o&apos;chirish
              </ActionButton>
            </div>
          )}
        </aside>
      </div>

      <Modal open={settings} onClose={() => setSettings(false)} title="Kurs sozlamalari" size="lg">
        <CourseForm c={course} onDone={() => setSettings(false)} />
      </Modal>

      <Modal open={!!mod} onClose={() => setMod(null)} title={mod === 'new' ? 'Yangi modul' : 'Modul nomi'} size="sm">
        {mod && (
          <ActionForm action={saveModule.bind(null, course.id, mod === 'new' ? null : mod.id)} onDone={() => setMod(null)} onCancel={() => setMod(null)}>
            <Field label="Modul nomi">
              <input name="title" defaultValue={mod === 'new' ? `${modules.length + 1}-modul. ` : mod.title} className="field" required />
            </Field>
          </ActionForm>
        )}
      </Modal>

      <Modal open={!!lesson} onClose={() => setLesson(null)} title={lesson?.l ? 'Darsni tahrirlash' : 'Yangi dars'} size="lg">
        {lesson && <LessonForm moduleId={lesson.moduleId} l={lesson.l} onDone={() => setLesson(null)} />}
      </Modal>
    </>
  );
}

function LessonForm({ moduleId, l, onDone }: { moduleId: number; l?: Lesson; onDone: () => void }) {
  const [kind, setKind] = useState(l?.kind ?? 'video');
  const [url, setUrl] = useState(l?.videoUrl ?? '');
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1];
  return (
    <ActionForm action={saveLesson.bind(null, moduleId, l?.id ?? null)} onDone={onDone} onCancel={onDone} submitLabel={l ? 'Saqlash' : "Darsni qo'shish"} resetOnSuccess={!l}>
      <input type="hidden" name="draftMarker" value="1" />
      <Field label="Dars nomi">
        <input name="title" defaultValue={l?.title} className="field" placeholder="Masalan: Prompt yozishning 5 qoidasi" required />
      </Field>
      <Field label="Turi">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(LESSON_KINDS).map(([k, v]) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-field border border-line-strong text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                {v}
              </span>
            </label>
          ))}
        </div>
      </Field>
      {kind === 'video' && (
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Video havolasi" hint="YouTube (ro'yxatsiz), Vimeo yoki Bunny Stream havolasi">
            <input name="videoUrl" value={url} onChange={(e) => setUrl(e.target.value)} className="field" placeholder="https://" />
          </Field>
          <Field label="Davomiyligi (daq)">
            <input type="number" name="durationMin" min={0} defaultValue={l?.durationMin ?? ''} className="field" />
          </Field>
        </div>
      )}
      {kind === 'video' && yt && (
        <div className="aspect-video overflow-hidden rounded-xl border border-line bg-ink">
          <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Video" className="h-full w-full" allowFullScreen />
        </div>
      )}
      {kind !== 'video' && (
        <Field label="Davomiyligi (daq)">
          <input type="number" name="durationMin" min={0} defaultValue={l?.durationMin ?? ''} className="field sm:w-40" />
        </Field>
      )}
      <Field label={kind === 'test' ? 'Savollar' : kind === 'topshiriq' ? 'Topshiriq sharti' : 'Dars matni / konspekt'}>
        <textarea name="content" defaultValue={l?.content ?? ''} rows={6} className="field" placeholder={kind === 'test' ? '1. Savol...\na) ...\nb) ...\nTo\'g\'ri javob: a' : ''} />
      </Field>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isFree" defaultChecked={l?.isFree} className="h-4 w-4 accent-[#0E7C6B]" />
          <Gift className="h-4 w-4 text-info" /> Bepul ko&apos;rish mumkin
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="published" defaultChecked={l ? l.published : true} className="h-4 w-4 accent-[#0E7C6B]" />
          <Eye className="h-4 w-4 text-brand" /> O&apos;quvchilarga ko&apos;rinadi
        </label>
      </div>
    </ActionForm>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className="mt-0.5 text-[17px] font-extrabold tnum">{value}</div>
    </div>
  );
}
