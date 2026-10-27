'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Magnet, Phone, Plus, UserPlus, Trash2, Calendar, PhoneCall, Target, MessageSquareQuote, X, Link2, Copy } from 'lucide-react';
import type { LeadStage } from '@/db/schema';
import { Badge, Button, Card, Field, PageHeader, cn } from '@/components/ui';
import { Modal, Drawer } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { NewStudentForm, type GroupOpt } from '@/components/forms';
import { useToast } from '@/components/toast';
import { deleteLead, logLeadCall, moveLead, saveLead, saveSalesPlan } from '@/app/actions/leads';
import { addNote } from '@/app/actions/students';
import { CALL_STATUSES, LEAD_SOURCES, LEAD_STAGES, OBJECTION_SCRIPTS } from '@/lib/constants';
import type { PlanRow } from '@/lib/sales';
import { phone } from '@/lib/format';
import { fmtDate, fmtMonth, relative } from '@/lib/dates';

const fmtMonthShort = (m: string) => fmtMonth(m).toLowerCase();

type Lead = {
  id: number;
  fullName: string;
  phone: string;
  source: string;
  stage: LeadStage;
  courseId: number | null;
  course: string | null;
  color: string | null;
  assignedToId: number | null;
  assigned: string | null;
  trialDate: string | null;
  callStatus: string | null;
  nextCallAt: string | null;
  lostReason: string | null;
  note: string | null;
  studentId: number | null;
  createdAt: string;
  updatedAt: string;
};

export function LeadsView({
  rows,
  courses,
  sales,
  groups,
  selectedId,
  history,
  openNew,
  meId,
  plan,
  month,
  isBoss,
  today,
  lostReasons,
  stageFilter,
  callsToday,
}: {
  plan: PlanRow[];
  month: string;
  isBoss: boolean;
  today: string;
  lostReasons: string[];
  stageFilter: string;
  callsToday: boolean;
  rows: Lead[];
  courses: { id: number; name: string }[];
  sales: { id: number; name: string }[];
  groups: GroupOpt[];
  selectedId: number | null;
  history: { id: number; kind: string; text: string; createdAt: string; by: string | null }[];
  openNew: boolean;
  meId: number;
}) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [, start] = useTransition();
  const [source, setSource] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [dueOnly, setDueOnly] = useState(callsToday);
  const [stageOnly, setStageOnly] = useState(stageFilter);
  const [planEdit, setPlanEdit] = useState<PlanRow | null>(null);
  const [links, setLinks] = useState(false);
  const [creating, setCreating] = useState(openNew);
  const [local, setLocal] = useState(rows);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [lost, setLost] = useState<number | null>(null);
  const [convert, setConvert] = useState<Lead | null>(null);
  useEffect(() => setLocal(rows), [rows]);
  useEffect(() => setCreating(openNew), [openNew]);

  const isDue = (l: Lead) => !!l.nextCallAt && l.nextCallAt <= today && !['tolov_qildi', 'rad_etdi'].includes(l.stage);
  const dueCount = local.filter(isDue).length;
  const filtered = useMemo(
    () => local.filter((l) => (!source || l.source === source) && (!onlyMine || l.assignedToId === meId) && (!dueOnly || isDue(l))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [local, source, onlyMine, meId, dueOnly, today],
  );
  const stages = stageOnly ? LEAD_STAGES.filter((s) => s.key === stageOnly) : LEAD_STAGES;
  const sources = useMemo(() => [...new Set(local.map((l) => l.source))], [local]);
  const conv = useMemo(() => {
    const total = filtered.length;
    const paid = filtered.filter((l) => l.stage === 'tolov_qildi').length;
    return { total, paid, rate: total ? Math.round((paid / total) * 100) : 0, open: filtered.filter((l) => !['tolov_qildi', 'rad_etdi'].includes(l.stage)).length };
  }, [filtered]);

  const go = (id: number | null) => router.push(id ? `${path}?id=${id}` : path, { scroll: false });

  const move = (id: number, stage: LeadStage) => {
    const l = local.find((x) => x.id === id);
    if (!l || l.stage === stage) return;
    if (stage === 'rad_etdi') return setLost(id);
    setLocal((s) => s.map((x) => (x.id === id ? { ...x, stage } : x)));
    start(async () => {
      const r = await moveLead(id, stage);
      if (!r.ok) {
        toast(r.error, 'err');
        setLocal(rows);
      } else {
        toast(`Bosqich: ${LEAD_STAGES.find((x) => x.key === stage)?.label}`);
        router.refresh();
        if (stage === 'tolov_qildi' && !l.studentId) setConvert(l);
      }
    });
  };

  const selected = selectedId ? local.find((l) => l.id === selectedId) : null;

  return (
    <>
      <PageHeader
        title="Lidlar"
        sub={`${conv.open} ta ochiq lid, konversiya ${conv.rate}%`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setLinks(true)}>
              <Link2 className="h-4 w-4" /> Ariza havolalari
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Lid qo&apos;shish
            </Button>
          </>
        }
      />

      {plan.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Target className="h-4 w-4 text-brand" /> Savdo rejasi, {fmtMonthShort(month)}
            <span className="font-normal text-fg-muted">— sotuv: lid o&apos;quvchiga aylanib, birinchi to&apos;lovini qilgan</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.map((p) => {
              const pc = p.target ? Math.min(100, Math.round((p.done / p.target) * 100)) : 0;
              return (
                <div key={p.userId} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 tnum">
                      <b>{p.done}</b>
                      <span className="text-fg-muted"> / {p.target || '—'}</span>
                      {isBoss && (
                        <button type="button" onClick={() => setPlanEdit(p)} className="ml-2 text-xs font-bold text-brand hover:underline">
                          Reja
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className={cn('h-full rounded-full', pc >= 100 ? 'bg-good' : 'bg-brand')} style={{ width: `${p.target ? pc : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip on={!source} onClick={() => setSource('')}>
          Barcha manbalar
        </Chip>
        {sources.map((s) => (
          <Chip key={s} on={source === s} onClick={() => setSource(s)}>
            {s} <span className="opacity-60">{local.filter((l) => l.source === s).length}</span>
          </Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Chip on={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
          Faqat menga biriktirilgan
        </Chip>
        <Chip on={dueOnly} onClick={() => setDueOnly((v) => !v)}>
          <PhoneCall className="h-3.5 w-3.5" /> Bugun qo&apos;ng&apos;iroq <span className="opacity-60">{dueCount}</span>
        </Chip>
        {stageOnly && (
          <Chip on onClick={() => setStageOnly('')}>
            {LEAD_STAGES.find((s) => s.key === stageOnly)?.label} <X className="h-3.5 w-3.5" />
          </Chip>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className={cn('grid gap-3', stageOnly ? 'grid-cols-1' : 'min-w-[1380px] grid-cols-6')}>
          {stages.map((st) => {
            const items = filtered.filter((l) => l.stage === st.key);
            return (
              <section
                key={st.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(st.key);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  if (drag) move(drag, st.key);
                  setDrag(null);
                }}
                className={cn('flex min-h-[420px] flex-col rounded-card border bg-white/60 transition-colors', over === st.key ? 'border-brand bg-brand-soft/60' : 'border-line')}
                aria-label={st.label}
              >
                <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                  <span className="text-xs font-bold text-fg-muted tnum">{items.length}</span>
                </header>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {items.map((l) => (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setDrag(l.id)}
                      onDragEnd={() => setDrag(null)}
                      onClick={() => go(l.id)}
                      className={cn('cursor-pointer rounded-xl border border-line bg-white p-3 shadow-lift transition-colors hover:border-line-strong', drag === l.id && 'opacity-50')}
                    >
                      <div className="truncate text-sm font-bold">{l.fullName}</div>
                      <div className="whitespace-nowrap text-xs text-fg-muted tnum">{phone(l.phone)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-canvas px-1.5 py-0.5 text-2xs font-bold text-fg-muted">{l.source}</span>
                        {l.course && (
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: l.color ?? '#8C9A97' }} />
                            <span className="truncate">{l.course}</span>
                          </span>
                        )}
                      </div>
                      {l.callStatus && !['tolov_qildi', 'rad_etdi'].includes(l.stage) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={CALL_STATUSES.find((c) => c.key === l.callStatus)?.tone}>{CALL_STATUSES.find((c) => c.key === l.callStatus)?.label}</Badge>
                          {l.nextCallAt && <span className={cn('text-2xs font-semibold', l.nextCallAt <= today ? 'text-bad' : 'text-fg-muted')}>{l.nextCallAt <= today ? "Bugun qo'ng'iroq" : fmtDate(l.nextCallAt)}</span>}
                        </div>
                      )}
                      {l.stage === 'sinov_yozildi' && l.trialDate && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-warn">
                          <Calendar className="h-3 w-3" /> Sinov: {fmtDate(l.trialDate)}
                        </div>
                      )}
                      {l.stage === 'rad_etdi' && l.lostReason && <div className="mt-1.5 text-xs text-bad">{l.lostReason}</div>}
                      <div className="mt-2 flex items-center justify-between text-2xs text-fg-faint">
                        <span className="truncate">{l.assigned ?? 'Biriktirilmagan'}</span>
                        <span className="shrink-0">{relative(l.createdAt)}</span>
                      </div>
                      {/* mobil/klaviatura uchun */}
                      <select
                        value={l.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => move(l.id, e.target.value as LeadStage)}
                        className="mt-2 h-8 w-full rounded-lg border border-line bg-canvas px-2 text-xs font-semibold lg:hidden"
                        aria-label="Bosqichni o'zgartirish"
                      >
                        {LEAD_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                  {items.length === 0 && <div className="grid h-24 place-items-center rounded-xl border border-dashed border-line text-xs text-fg-faint">Bu yerga sudrang</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {local.length === 0 && (
        <Card className="mt-2 flex items-center gap-3 p-4 text-sm text-fg-muted">
          <Magnet className="h-5 w-5 text-brand" /> Instagram, target yoki ofisga kelgan har bir qiziquvchini shu yerga kiriting. Kartani ustunlar orasida sudrab bosqichini o&apos;zgartirasiz.
        </Card>
      )}

      <Modal open={creating} onClose={() => (openNew ? router.push(path) : setCreating(false))} title="Yangi lid">
        <LeadForm courses={courses} sales={sales} onDone={() => (openNew ? router.push(path) : setCreating(false))} />
      </Modal>

      <Modal open={lost !== null} onClose={() => setLost(null)} title="Nega rad etdi?" size="sm">
        <ActionForm
          action={async (fd) => {
            const r = await moveLead(lost!, 'rad_etdi', String(fd.get('reason') || ''));
            return r;
          }}
          onDone={() => setLost(null)}
          onCancel={() => setLost(null)}
          submitLabel="Rad etdi deb belgilash"
          danger
        >
          <Field label="Sabab">
            <select name="reason" className="field" required defaultValue="">
              <option value="" disabled>
                Tanlang
              </option>
              {(lostReasons.length ? lostReasons : ['Narx qimmat', 'Vaqt mos emas', 'Boshqa']).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </Modal>

      <Modal open={!!convert} onClose={() => setConvert(null)} title="O'quvchiga aylantirish" sub="Lid to'lov qildi. Uni o'quvchilar ro'yxatiga qo'shing va guruhga yozing.">
        {convert && <NewStudentForm groups={groups} lead={convert} onDone={() => setConvert(null)} onCancel={() => setConvert(null)} />}
      </Modal>

      <Modal open={links} onClose={() => setLinks(false)} title="Ariza havolalari" sub="Har bir kanalga o'z havolasini qo'ying — ariza shu manba bilan lid bo'lib tushadi">
        <LinkList />
      </Modal>

      <Modal open={!!planEdit} onClose={() => setPlanEdit(null)} title="Savdo rejasi" sub={planEdit ? `${planEdit.name}, ${fmtMonthShort(month)}` : undefined} size="sm">
        {planEdit && (
          <ActionForm action={saveSalesPlan.bind(null, planEdit.userId, month)} onDone={() => setPlanEdit(null)} onCancel={() => setPlanEdit(null)}>
            <Field label="Nechta sotuv" hint="Lid o'quvchiga aylanib, birinchi to'lovini qilsa — sotuv hisoblanadi">
              <input type="number" name="target" min={0} max={1000} defaultValue={planEdit.target || ''} className="field" required />
            </Field>
          </ActionForm>
        )}
      </Modal>

      {selected && (
        <Drawer
          open
          onClose={() => go(null)}
          title={selected.fullName}
          sub={
            <span className="inline-flex items-center gap-2">
              {LEAD_STAGES.find((s) => s.key === selected.stage)?.label}, {selected.source}
            </span>
          }
        >
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <a href={`tel:+${selected.phone}`} className="inline-flex h-9 items-center gap-2 rounded-field bg-brand px-3.5 text-[13px] font-bold text-white">
                <Phone className="h-4 w-4" /> {phone(selected.phone)}
              </a>
              {!selected.studentId && (
                <Button size="sm" variant="secondary" onClick={() => setConvert(selected)}>
                  <UserPlus className="h-4 w-4" /> O&apos;quvchiga aylantirish
                </Button>
              )}
              <ActionButton
                variant="ghost"
                action={async () => {
                  const r = await deleteLead(selected.id);
                  if (r.ok) go(null);
                  return r;
                }}
                confirm="Lid o'chirilsinmi?"
              >
                <Trash2 className="h-4 w-4" /> O&apos;chirish
              </ActionButton>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => move(selected.id, s.key)}
                  className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', selected.stage === s.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted hover:text-fg')}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Card className="p-4">
              <LeadForm key={selected.id} lead={selected} courses={courses} sales={sales} />
            </Card>
            <Card className="p-4">
              <CallForm key={selected.id} id={selected.id} today={today} />
            </Card>
            <Scripts />
            <Card className="p-4">
              <ActionForm action={addNote.bind(null, 'lead', selected.id)} submitLabel="Yozib qo'yish" resetOnSuccess>
                <input type="hidden" name="kind" value="izoh" />
                <Field label="Izoh">
                  <textarea name="text" rows={2} className="field" placeholder="Masalan: onasi bilan gaplashish kerak" required />
                </Field>
              </ActionForm>
            </Card>
            <div className="card divide-y divide-line">
              <div className="px-4 py-2.5 text-sm font-bold">Tarix</div>
              {history.length === 0 && <p className="px-4 py-3 text-sm text-fg-muted">Hali yozuv yo&apos;q.</p>}
              {history.map((h) => (
                <div key={h.id} className="px-4 py-3">
                  <div className="text-xs text-fg-muted">
                    {h.by ?? 'Tizim'}, {relative(h.createdAt)}
                  </div>
                  <p className="mt-1 text-sm">{h.text.replace(/^Bosqich: (\w+)/, (_, k) => `Bosqich: ${LEAD_STAGES.find((s) => s.key === k)?.label ?? k}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}

function LeadForm({ lead, courses, sales, onDone }: { lead?: Lead; courses: { id: number; name: string }[]; sales: { id: number; name: string }[]; onDone?: () => void }) {
  return (
    <ActionForm action={saveLead.bind(null, lead?.id ?? null)} onDone={onDone} onCancel={onDone} submitLabel={lead ? 'Saqlash' : "Lid qo'shish"} resetOnSuccess={!lead}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism">
          <input name="fullName" defaultValue={lead?.fullName} className="field" required />
        </Field>
        <Field label="Telefon">
          <input name="phone" type="tel" defaultValue={lead?.phone} className="field" placeholder="90 123 45 67" required />
        </Field>
        <Field label="Manba">
          <select name="source" defaultValue={lead?.source ?? 'Instagram'} className="field">
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Qiziqqan yo'nalishi">
          <select name="courseId" defaultValue={lead?.courseId ?? ''} className="field">
            <option value="">Aniq emas</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mas'ul sotuvchi">
          <select name="assignedToId" defaultValue={lead?.assignedToId ?? ''} className="field">
            <option value="">Biriktirilmagan</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sinov darsi sanasi">
          <input type="date" name="trialDate" defaultValue={lead?.trialDate ?? ''} className="field" />
        </Field>
      </div>
      <Field label="Izoh">
        <textarea name="note" defaultValue={lead?.note ?? ''} rows={2} className="field" />
      </Field>
    </ActionForm>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted hover:text-fg')}>
      {children}
    </button>
  );
}

function CallForm({ id, today }: { id: number; today: string }) {
  const [st, setSt] = useState('');
  const plus = (d: number) => {
    const x = new Date(today + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + d);
    return x.toISOString().slice(0, 10);
  };
  const [next, setNext] = useState('');
  return (
    <ActionForm action={logLeadCall.bind(null, id)} submitLabel="Qayd etish" resetOnSuccess onDone={() => { setSt(''); setNext(''); }}>
      <fieldset>
        <legend className="label">Qo&apos;ng&apos;iroq natijasi</legend>
        <input type="hidden" name="callStatus" value={st} />
        <div className="flex flex-wrap gap-1.5">
          {CALL_STATUSES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setSt(c.key);
                if (c.key === 'javob_bermadi' || c.key === 'qayta_qongiroq') setNext(plus(1));
                else if (c.key === 'oylab_koradi') setNext(plus(3));
                else setNext('');
              }}
              className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', st === c.key ? 'border-ink bg-ink text-white' : 'border-line-strong text-fg-muted')}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Keyingi qo'ng'iroq">
          <input type="date" name="nextCallAt" value={next} onChange={(e) => setNext(e.target.value)} min={today} className="field" />
        </Field>
        <Field label="Nima deyishdi">
          <input name="text" className="field" maxLength={500} placeholder="Masalan: shanba kuni sinovga keladi" />
        </Field>
      </div>
    </ActionForm>
  );
}

function Scripts() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="card">
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
        <MessageSquareQuote className="h-4 w-4 text-brand" /> E&apos;tirozlarga javob
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {OBJECTION_SCRIPTS.map((x, i) => (
          <li key={x.q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-semibold hover:bg-canvas">
              &laquo;{x.q}&raquo;
              <span className="text-fg-faint">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="px-4 pb-3 text-[13px] leading-relaxed text-fg-muted">{x.a}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkList() {
  const toast = useToast();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {LEAD_SOURCES.filter((x) => !['Ofisga keldi', "Qo'ng'iroq", 'Boshqa'].includes(x)).map((src) => {
        const url = `${origin}/akademiya/ariza?m=${encodeURIComponent(src)}`;
        return (
          <li key={src} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{src}</div>
              <div className="truncate text-xs text-fg-muted">{url}</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast('Havola nusxalandi');
                } catch {
                  toast("Nusxalab bo'lmadi", 'err');
                }
              }}
            >
              <Copy className="h-4 w-4" /> Nusxa
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
