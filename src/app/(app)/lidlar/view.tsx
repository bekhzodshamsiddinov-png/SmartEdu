'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Magnet, Phone, Plus, UserPlus, Trash2, Calendar, PhoneCall, Target, MessageSquareQuote, X, Link2, Copy, Search, BarChart3, Repeat, Clock, Megaphone, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { LeadStage } from '@/db/schema';
import { Badge, Button, Card, Field, PageHeader, cn } from '@/components/ui';
import { Modal, Drawer } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { NewStudentForm, type GroupOpt } from '@/components/forms';
import { useToast } from '@/components/toast';
import { checkLeadPhone, deleteLead, logLeadCall, moveLead, saveLead, saveSalesPlan, searchReferrers } from '@/app/actions/leads';
import { addNote } from '@/app/actions/students';
import { CALL_STATUSES, LEAD_SOURCES, LEAD_STAGES, OBJECTION_SCRIPTS, REFERRAL_SOURCES, SOURCE_COLOR, TOUCH_VIA } from '@/lib/constants';
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
  campaign: string | null;
  ad: string | null;
  touches: number;
  lastTouchAt: string;
  referredById: number | null;
  referredBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type Touch = { id: number; source: string; campaign: string | null; ad: string | null; via: string; detail: string | null; createdAt: string; by: string | null };

const srcColor = (s: string) => SOURCE_COLOR[s] ?? '#8C9A97';

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
  touches,
  campaigns,
  canReport,
}: {
  touches: Touch[];
  campaigns: string[];
  canReport: boolean;
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
  const [campaign, setCampaign] = useState('');
  const [q, setQ] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
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
    () => {
      const t = q.trim().toLowerCase();
      const d = t.replace(/\D/g, '');
      return local.filter(
        (l) =>
          (!source || l.source === source) &&
          (!campaign || l.campaign === campaign) &&
          (!t || l.fullName.toLowerCase().includes(t) || (d.length >= 3 && l.phone.includes(d))) &&
          (!onlyMine || l.assignedToId === meId) &&
          (!dueOnly || isDue(l)),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [local, source, campaign, q, onlyMine, meId, dueOnly, today],
  );
  const stages = stageOnly ? LEAD_STAGES.filter((s) => s.key === stageOnly) : LEAD_STAGES;
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of local) m.set(l.source, (m.get(l.source) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [local]);
  const srcCampaigns = useMemo(() => (source ? [...new Set(local.filter((l) => l.source === source && l.campaign).map((l) => l.campaign!))] : []), [local, source]);
  const waitMin = (l: Lead) => (now && l.stage === 'yangi' && !l.callStatus ? Math.floor((now - Date.parse(l.createdAt)) / 60000) : -1);
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
            {canReport && (
              <Link href="/lidlar/manbalar" className="inline-flex h-10 items-center gap-2 rounded-field border border-line-strong bg-white px-4 text-sm font-bold hover:bg-canvas">
                <BarChart3 className="h-4 w-4" /> Manbalar hisoboti
              </Link>
            )}
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

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki telefon" className="field h-9 pl-9" aria-label="Lid qidirish" />
        </div>
        {srcCampaigns.length > 0 && (
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="field h-9 sm:max-w-xs" aria-label="Kampaniya">
            <option value="">Barcha kampaniyalar</option>
            {srcCampaigns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip on={!source} onClick={() => { setSource(''); setCampaign(''); }}>
          Barcha manbalar <span className="opacity-60">{local.length}</span>
        </Chip>
        {sources.map(([s, n]) => (
          <Chip key={s} on={source === s} onClick={() => { setSource(source === s ? '' : s); setCampaign(''); }}>
            <span className="h-2 w-2 rounded-full" style={{ background: srcColor(s) }} />
            {s} <span className="opacity-60">{n}</span>
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 truncate text-sm font-bold">{l.fullName}</div>
                        {l.touches > 1 && (
                          <span title={`${l.touches} marta murojaat qilgan`} className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-warn-soft px-1.5 py-0.5 text-2xs font-bold text-warn">
                            <Repeat className="h-3 w-3" /> {l.touches}
                          </span>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-xs text-fg-muted tnum">{phone(l.phone)}</div>
                      {waitMin(l) >= 15 && (
                        <div className={cn('mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold', waitMin(l) >= 60 ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn')}>
                          <Clock className="h-3 w-3" /> {waitMin(l) >= 1440 ? `${Math.floor(waitMin(l) / 1440)} kun` : waitMin(l) >= 60 ? `${Math.floor(waitMin(l) / 60)} soat` : `${waitMin(l)} daqiqa`} qo&apos;ng&apos;iroq kutyapti
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold text-white" style={{ background: srcColor(l.source) }}>
                          {l.source}
                        </span>
                        {l.course && (
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: l.color ?? '#8C9A97' }} />
                            <span className="truncate">{l.course}</span>
                          </span>
                        )}
                      </div>
                      {l.campaign && (
                        <div className="mt-1 flex min-w-0 items-center gap-1 text-2xs font-semibold text-fg-muted" title={[l.campaign, l.ad].filter(Boolean).join(' · ')}>
                          <Megaphone className="h-3 w-3 shrink-0" /> <span className="truncate">{l.campaign}{l.ad ? ` · ${l.ad}` : ''}</span>
                        </div>
                      )}
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
        <LeadForm
          courses={courses}
          sales={sales}
          campaigns={campaigns}
          onDone={(id) => {
            if (openNew) router.push(id ? `${path}?id=${id}` : path);
            else {
              setCreating(false);
              if (id) go(id);
            }
          }}
          onCancel={() => (openNew ? router.push(path) : setCreating(false))}
        />
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
              {selected.campaign ? ` · ${selected.campaign}` : ''}
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
              <LeadForm key={selected.id} lead={selected} courses={courses} sales={sales} campaigns={campaigns} />
            </Card>
            <div className="card divide-y divide-line">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm font-bold">
                <span>Murojaatlar</span>
                <span className="text-xs font-semibold text-fg-muted">{touches.length} marta</span>
              </div>
              {touches.map((t, i) => (
                <div key={t.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: srcColor(t.source) }} />
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold">
                      {t.source}
                      {t.campaign && <span className="font-normal text-fg-muted"> · {t.campaign}{t.ad ? ` · ${t.ad}` : ''}</span>}
                      {i === touches.length - 1 && <Badge tone="brand" className="ml-2">birinchi</Badge>}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {TOUCH_VIA[t.via] ?? t.via}
                      {t.by ? `, ${t.by}` : ''}, {relative(t.createdAt)}
                    </div>
                    {t.detail && <p className="mt-0.5 break-words text-xs text-fg-muted">{t.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
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

function LeadForm({
  lead,
  courses,
  sales,
  campaigns,
  onDone,
  onCancel,
}: {
  lead?: Lead;
  courses: { id: number; name: string }[];
  sales: { id: number; name: string }[];
  campaigns: string[];
  onDone?: (id?: number) => void;
  onCancel?: () => void;
}) {
  const [src, setSrc] = useState(lead?.source ?? '');
  const [dup, setDup] = useState<Awaited<ReturnType<typeof checkLeadPhone>>>(null);
  const [refQ, setRefQ] = useState(lead?.referredBy ?? '');
  const [refId, setRefId] = useState<number | null>(lead?.referredById ?? null);
  const [refOpts, setRefOpts] = useState<{ id: number; name: string; status: string }[]>([]);
  const ads = src === 'Instagram target' || src === 'Facebook target';
  return (
    <ActionForm
      action={saveLead.bind(null, lead?.id ?? null)}
      onDone={(r) => onDone?.(r.ok && !lead ? r.id : undefined)}
      onCancel={onCancel}
      submitLabel={lead ? 'Saqlash' : "Lid qo'shish"}
      resetOnSuccess={!lead}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism">
          <input name="fullName" defaultValue={lead?.fullName} className="field" required maxLength={80} />
        </Field>
        <Field label="Telefon">
          <input
            name="phone"
            type="tel"
            defaultValue={lead?.phone}
            className="field"
            placeholder="90 123 45 67"
            required
            onBlur={async (e) => {
              if (lead) return;
              const v = e.currentTarget.value;
              setDup(v.replace(/\D/g, '').length >= 9 ? await checkLeadPhone(v) : null);
            }}
          />
        </Field>
      </div>
      {dup && (dup.lead || dup.student) && (
        <div className="flex items-start gap-2 rounded-field border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] text-warn" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {dup.lead && (
              <div>
                Bu raqam bazada bor: <b>{dup.lead.name}</b> ({dup.lead.source}, {LEAD_STAGES.find((x) => x.key === dup.lead!.stage)?.label}). Saqlasangiz yangi lid ochilmaydi — unga murojaat qo&apos;shiladi.
                {dup.lead.id && (
                  <>
                    {' '}
                    <Link href={`/lidlar?id=${dup.lead.id}`} className="font-bold underline">
                      Ochish
                    </Link>
                  </>
                )}
              </div>
            )}
            {dup.student && <div>Bu raqam o&apos;quvchi <b>{dup.student}</b> ga tegishli.</div>}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qayerdan keldi (manba)">
          <select name="source" value={src} onChange={(e) => setSrc(e.target.value)} className="field" required>
            <option value="" disabled>
              Tanlang
            </option>
            {LEAD_SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
            {lead && !LEAD_SOURCES.includes(lead.source) && <option>{lead.source}</option>}
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
        <Field label={ads ? 'Kampaniya' : 'Kampaniya / aksiya'} hint={ads ? 'Qaysi reklama — keyin hisobotda solishtiriladi' : 'Ixtiyoriy'}>
          <input name="campaign" list="lead-campaigns" defaultValue={lead?.campaign ?? ''} maxLength={120} className="field" placeholder={ads ? 'Masalan: Oktabr AI kursi' : ''} />
          <datalist id="lead-campaigns">
            {campaigns.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {ads ? (
          <Field label="Reklama / video">
            <input name="ad" defaultValue={lead?.ad ?? ''} maxLength={120} className="field" placeholder="Masalan: Video 2" />
          </Field>
        ) : (
          <input type="hidden" name="ad" value={lead?.ad ?? ''} />
        )}
        {REFERRAL_SOURCES.includes(src) && (
          <Field label="Kim tavsiya qildi" hint="O'quvchi yoki bitiruvchi — tavsiyalar hisobiga yoziladi">
            <input type="hidden" name="referredByStudentId" value={refId ?? ''} />
            <input
              value={refQ}
              onChange={async (e) => {
                const v = e.target.value;
                setRefQ(v);
                setRefId(null);
                setRefOpts(v.trim().length >= 2 ? await searchReferrers(v) : []);
              }}
              className="field"
              placeholder="Ism bilan qidiring"
              autoComplete="off"
            />
            {refOpts.length > 0 && !refId && (
              <ul className="mt-1 max-h-44 overflow-auto rounded-field border border-line bg-white text-sm shadow-lift">
                {refOpts.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setRefId(o.id);
                        setRefQ(o.name);
                        setRefOpts([]);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-canvas"
                    >
                      {o.name} <span className="text-xs text-fg-muted">{o.status === 'bitirgan' ? 'bitiruvchi' : "o'quvchi"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )}
        <Field label="Mas'ul sotuvchi">
          <select name="assignedToId" defaultValue={lead?.assignedToId ?? ''} className="field">
            <option value="">Biriktirilmagan</option>
            {sales.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sinov darsi sanasi">
          <input type="date" name="trialDate" defaultValue={lead?.trialDate ?? ''} className="field" />
        </Field>
      </div>
      <Field label="Izoh">
        <textarea name="note" defaultValue={lead?.note ?? ''} rows={2} className="field" maxLength={1000} />
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
      {LEAD_SOURCES.filter((x) => !['Ofisga keldi', "Qo'ng'iroq", 'Boshqa', 'uitc.uz', 'Akademiya sayti'].includes(x)).map((src) => {
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
