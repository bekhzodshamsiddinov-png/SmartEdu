'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil, Plus, Ticket, XCircle } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { PlanCard, type PlanLite } from '@/components/plan-card';
import { cancelSubscription, savePlan } from '@/app/actions/subscriptions';
import { money } from '@/lib/format';
import { fmtDate, fmtShort } from '@/lib/dates';

type Plan = PlanLite & { course_id: number | null; active: boolean; sold: number };
type Sold = { id: number; student_id: number; student: string; grp: string; name: string; kind: string; start_date: string; end_date: string; lessons_total: number; used: number; price: number; status: string; refund: number; cancel_reason: string | null };

const COLORS = ['#D93A08', '#0C1631', '#1878AE', '#0E7C6B', '#7A5BC7', '#C2862A'];

/** Abonement holati: faol, tugayapti (7 kun yoki 2 dars qoldi), tugagan, bekor */
function stateOf(s: Sold, today: string) {
  if (s.status === 'bekor') return { k: 'bekor', l: 'Bekor qilingan', tone: 'neutral' as const };
  if (s.status === 'toxtatildi') return { k: 'toxtatildi', l: "To'xtatilgan", tone: 'neutral' as const };
  const left = s.kind === 'dars' ? s.lessons_total - s.used : null;
  if (s.end_date < today || (left !== null && left <= 0)) return { k: 'tugagan', l: 'Tugagan', tone: 'bad' as const };
  const days = Math.round((Date.parse(s.end_date) - Date.parse(today)) / 864e5);
  if (days <= 7 || (left !== null && left <= 2)) return { k: 'tugayapti', l: 'Tugayapti', tone: 'warn' as const };
  if (s.start_date > today) return { k: 'kutilmoqda', l: 'Boshlanmagan', tone: 'info' as const };
  return { k: 'faol', l: 'Faol', tone: 'good' as const };
}

export function SubscriptionsView({ plans, sold, courses, today, isBoss, canCancel, tab }: { plans: Plan[]; sold: Sold[]; courses: { id: number; name: string }[]; today: string; isBoss: boolean; canCancel: boolean; tab: 'paketlar' | 'sotilgan' }) {
  const router = useRouter();
  const path = usePathname();
  const [edit, setEdit] = useState<Plan | 'new' | null>(null);
  const [cancel, setCancel] = useState<Sold | null>(null);
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => sold.map((s) => ({ ...s, st: stateOf(s, today) })), [sold, today]);
  const counts = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.st.k]: (a[r.st.k] ?? 0) + 1 }), {});
  const activeSum = rows.filter((r) => ['faol', 'tugayapti', 'kutilmoqda'].includes(r.st.k)).reduce((s, r) => s + r.price, 0);
  const list = filter ? rows.filter((r) => r.st.k === filter) : rows;

  return (
    <>
      <PageHeader
        title="Abonementlar"
        sub="Bir necha oy yoki darsga oldindan to'lov — chegirma bilan. O'quvchi profilidan sotiladi."
        actions={
          isBoss && (
            <Button onClick={() => setEdit('new')}>
              <Plus className="h-4 w-4" /> Paket
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini l="Faol abonementlar" v={String((counts.faol ?? 0) + (counts.tugayapti ?? 0) + (counts.kutilmoqda ?? 0))} />
        <Mini l="Ularning summasi" v={money(activeSum)} />
        <Mini l="Tugayapti" v={String(counts.tugayapti ?? 0)} tone={counts.tugayapti ? 'warn' : undefined} />
        <Mini l="Paketlar" v={String(plans.filter((p) => p.active).length)} />
      </div>
      <div className="mb-4 inline-flex rounded-field border border-line bg-white p-1">
        {(['paketlar', 'sotilgan'] as const).map((t) => (
          <button key={t} onClick={() => router.replace(t === 'paketlar' ? path : `${path}?tab=${t}`, { scroll: false })} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === t ? 'bg-ink text-white' : 'text-fg-muted')}>
            {t === 'paketlar' ? 'Paketlar' : "Sotilganlar"}
          </button>
        ))}
      </div>

      {tab === 'paketlar' ? (
        plans.length === 0 ? (
          <Card>
            <Empty icon={<Ticket className="h-5 w-5" />} title="Hali paket yo'q" text="Masalan: «3 oylik — 10% chegirma» yoki «12 darslik». Paket qo'shing, keyin o'quvchi profilidan soting." action={isBoss ? <Button onClick={() => setEdit('new')}>Paket qo&apos;shish</Button> : undefined} />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className={cn('relative', !p.active && 'opacity-50')}>
                <PlanCard p={p} />
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-fg-muted">
                  <span>{p.sold} ta sotilgan{!p.active && ' · o\'chirilgan'}</span>
                  {isBoss && (
                    <button onClick={() => setEdit(p)} className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
                      <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
            {[['', 'Hammasi'], ['faol', 'Faol'], ['tugayapti', 'Tugayapti'], ['tugagan', 'Tugagan'], ['bekor', 'Bekor']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', filter === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted')}>
                {l}
                {k && counts[k] ? <span className="opacity-60">{counts[k]}</span> : null}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-fg-muted">Abonement yo&apos;q. O&apos;quvchi profilida «Abonement» tugmasi orqali sotiladi.</p>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((r) => {
                const total = r.kind === 'dars' ? r.lessons_total : Math.max(1, Math.round((Date.parse(r.end_date) - Date.parse(r.start_date)) / 864e5) + 1);
                const done = r.kind === 'dars' ? r.used : Math.min(total, Math.max(0, Math.round((Date.parse(today) - Date.parse(r.start_date)) / 864e5) + 1));
                const pc = Math.min(100, Math.round((done / total) * 100));
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-[180px] flex-1">
                      <Link href={`/oquvchilar?id=${r.student_id}`} className="font-bold hover:text-brand">
                        {r.student}
                      </Link>
                      <div className="text-xs text-fg-muted">
                        {r.name} · {r.grp} · {fmtShort(r.start_date)} — {fmtDate(r.end_date)}
                      </div>
                      {r.cancel_reason && <div className="text-xs text-fg-muted">Sabab: {r.cancel_reason}{r.refund ? `, qaytarildi ${money(r.refund)}` : ''}</div>}
                    </div>
                    <div className="w-40">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-fg-muted tnum">
                        <span>{r.kind === 'dars' ? `${r.used}/${r.lessons_total} dars` : `${done}/${total} kun`}</span>
                        <span>{pc}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div className={cn('h-full rounded-full', r.st.k === 'tugayapti' ? 'bg-warn' : 'bg-brand')} style={{ width: `${pc}%` }} />
                      </div>
                    </div>
                    <div className="w-28 text-right font-bold tnum">{money(r.price)}</div>
                    <Badge tone={r.st.tone}>{r.st.l}</Badge>
                    {canCancel && r.status === 'faol' && (
                      <Button size="icon" variant="ghost" onClick={() => setCancel(r)} aria-label="Bekor qilish" title="Bekor qilish">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi paket' : 'Paketni tahrirlash'}>
        {edit && <PlanForm p={edit === 'new' ? null : edit} courses={courses} onDone={() => setEdit(null)} />}
      </Modal>
      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Abonementni bekor qilish" sub={cancel ? `${cancel.student}, ${cancel.name}` : undefined} size="sm">
        {cancel && <CancelForm s={cancel} today={today} onDone={() => setCancel(null)} />}
      </Modal>
    </>
  );
}

function PlanForm({ p, courses, onDone }: { p: Plan | null; courses: { id: number; name: string }[]; onDone: () => void }) {
  const [kind, setKind] = useState(p?.kind ?? 'oy');
  const [color, setColor] = useState(p?.color ?? COLORS[0]);
  return (
    <ActionForm action={savePlan.bind(null, p?.id ?? null)} onDone={onDone} onCancel={onDone}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomi">
          <input name="name" defaultValue={p?.name ?? ''} maxLength={60} className="field" placeholder="Masalan: 3 oylik" required />
        </Field>
        <Field label="Yo'nalish">
          <select name="courseId" defaultValue={p?.course_id ?? ''} className="field">
            <option value="">Barcha yo&apos;nalishlar</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend className="label">Turi</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { k: 'oy', t: 'Oylik', d: "N oy uchun oldindan — shu oylarda oylik to'lov yechilmaydi" },
            { k: 'dars', t: 'Darslik', d: 'N ta dars, muddat ichida ishlatiladi ("dars bo\'yicha" guruhlar uchun)' },
          ].map((o) => (
            <button key={o.k} type="button" onClick={() => setKind(o.k)} aria-pressed={kind === o.k} className={cn('rounded-xl border px-3.5 py-2.5 text-left', kind === o.k ? 'border-brand bg-brand-soft' : 'border-line hover:bg-canvas')}>
              <div className="text-sm font-bold">{o.t}</div>
              <div className="text-xs text-fg-muted">{o.d}</div>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        {kind === 'oy' ? (
          <Field label="Necha oy">
            <input type="number" name="months" min={1} max={24} defaultValue={p?.months ?? 3} className="field" />
          </Field>
        ) : (
          <>
            <Field label="Necha dars">
              <input type="number" name="lessons" min={1} max={300} defaultValue={p?.lessons ?? 12} className="field" />
            </Field>
            <Field label="Amal qilish, kun">
              <input type="number" name="validDays" min={7} max={730} defaultValue={p?.valid_days ?? 45} className="field" />
            </Field>
          </>
        )}
        <Field label="Narx">
          <MoneyInput name="price" defaultValue={p?.price} required />
        </Field>
        <Field label="Chegirmasiz narx" hint="Ixtiyoriy — chizib ko'rsatiladi">
          <MoneyInput name="oldPrice" defaultValue={p?.old_price ?? undefined} />
        </Field>
      </div>
      <Field label="Qo'shimcha afzallik">
        <input name="description" defaultValue={p?.description ?? ''} maxLength={200} className="field" placeholder="Masalan: bepul kitob va sertifikat" />
      </Field>
      <fieldset>
        <legend className="label">Rang</legend>
        <input type="hidden" name="color" value={color} />
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={cn('h-8 w-8 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink')} style={{ background: c }} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="popular" defaultChecked={p?.popular} className="h-4 w-4 accent-[#0E7C6B]" /> «Ommabop» belgisi
        </label>
        {p && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-[#0E7C6B]" /> Sotuvda
          </label>
        )}
      </div>
    </ActionForm>
  );
}

function CancelForm({ s, today, onDone }: { s: Sold; today: string; onDone: () => void }) {
  const [mode, setMode] = useState<'sanadan' | 'toliq'>('sanadan');
  return (
    <ActionForm action={cancelSubscription.bind(null, s.id)} onDone={onDone} onCancel={onDone} danger submitLabel="Bekor qilish">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-2">
        {[
          { k: 'sanadan' as const, t: 'Tanlangan sanadan', d: s.kind === 'oy' ? "Shu oy ishlatilgan hisoblanadi, keyingi to'liq oylar puli qaytariladi" : "Ishlatilmagan darslar puli qaytariladi" },
          { k: 'toliq' as const, t: "Butunlay (to'liq qaytarish)", d: "Abonement narxi to'liq qaytariladi, o'tgan davr oddiy tartibda hisoblanadi" },
        ].map((o) => (
          <button key={o.k} type="button" onClick={() => setMode(o.k)} aria-pressed={mode === o.k} className={cn('rounded-xl border px-3.5 py-2.5 text-left', mode === o.k ? 'border-bad bg-bad-soft' : 'border-line hover:bg-canvas')}>
            <div className="text-sm font-bold">{o.t}</div>
            <div className="text-xs text-fg-muted">{o.d}</div>
          </button>
        ))}
      </div>
      {mode === 'sanadan' && (
        <Field label="Qaysi sanadan">
          <input type="date" name="from" min={s.start_date} max={s.end_date} defaultValue={today < s.start_date ? s.start_date : today > s.end_date ? s.end_date : today} className="field" required />
        </Field>
      )}
      <Field label="Sabab">
        <input name="reason" maxLength={200} className="field" required />
      </Field>
      <p className="rounded-field bg-info-soft px-3 py-2.5 text-[13px] text-info">Qaytariladigan summa o&apos;quvchi hisobiga tushadi. Naqd qaytarilsa — Moliya bo&apos;limida xarajat sifatida yozing.</p>
    </ActionForm>
  );
}

function Mini({ l, v, tone }: { l: string; v: string; tone?: 'warn' }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-semibold text-fg-muted">{l}</div>
      <div className={cn('mt-1 text-lg font-extrabold tnum', tone === 'warn' && 'text-warn')}>{v}</div>
    </div>
  );
}
