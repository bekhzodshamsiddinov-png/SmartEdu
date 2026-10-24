'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Magnet, Phone, Plus, UserPlus, Trash2, Calendar } from 'lucide-react';
import type { LeadStage } from '@/db/schema';
import { Badge, Button, Card, Field, PageHeader, cn } from '@/components/ui';
import { Modal, Drawer } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { NewStudentForm, type GroupOpt } from '@/components/forms';
import { useToast } from '@/components/toast';
import { deleteLead, moveLead, saveLead } from '@/app/actions/leads';
import { addNote } from '@/app/actions/students';
import { LEAD_SOURCES, LEAD_STAGES } from '@/lib/constants';
import { phone } from '@/lib/format';
import { fmtDate, relative } from '@/lib/dates';

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
}: {
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
  const [creating, setCreating] = useState(openNew);
  const [local, setLocal] = useState(rows);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [lost, setLost] = useState<number | null>(null);
  const [convert, setConvert] = useState<Lead | null>(null);
  useEffect(() => setLocal(rows), [rows]);
  useEffect(() => setCreating(openNew), [openNew]);

  const filtered = useMemo(() => local.filter((l) => (!source || l.source === source) && (!onlyMine || l.assignedToId === meId)), [local, source, onlyMine, meId]);
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
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Lid qo&apos;shish
          </Button>
        }
      />

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
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[1380px] grid-cols-6 gap-3">
          {LEAD_STAGES.map((st) => {
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
              {['Narx qimmat', 'Vaqt mos emas', 'Uzoq masofa', "Boshqa markazni tanladi", "Hozircha kerak emas", "Javob bermayapti", 'Boshqa'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </Modal>

      <Modal open={!!convert} onClose={() => setConvert(null)} title="O'quvchiga aylantirish" sub="Lid to'lov qildi. Uni o'quvchilar ro'yxatiga qo'shing va guruhga yozing.">
        {convert && <NewStudentForm groups={groups} lead={convert} onDone={() => setConvert(null)} onCancel={() => setConvert(null)} />}
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
              <ActionForm action={addNote.bind(null, 'lead', selected.id)} submitLabel="Yozib qo'yish" resetOnSuccess>
                <input type="hidden" name="kind" value="qongiroq" />
                <Field label="Qo'ng'iroq natijasi">
                  <textarea name="text" rows={2} className="field" placeholder="Masalan: Shanba kuni sinov darsiga keladi" required />
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
