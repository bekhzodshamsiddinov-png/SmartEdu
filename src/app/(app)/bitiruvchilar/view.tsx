'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, GraduationCap, Laptop, Medal, MessageCircle, Pencil, Phone, Search, School, Users } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, Stat, cn } from '@/components/ui';
import { Modal, Drawer } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { ResultForm } from '@/components/results';
import { addGraduateContact, graduateHistory, saveGraduate } from '@/app/actions/alumni';
import { ALUMNI_CHANNELS, LEAD_STAGES, RESULT_META } from '@/lib/constants';
import { money, phone, pct } from '@/lib/format';
import { addDays, daysBetween, fmtDate, fmtShort, today } from '@/lib/dates';

export type GradRow = {
  id: number; name: string; phone: string | null; graduated_at: string | null; course: string | null; color: string | null;
  workplace: string | null; position: string | null; monthly_income: number | null; freelance: boolean | null; studying_at: string | null;
  last_contact_at: string | null; next_contact_at: string | null; referrals: number; in_telegram_group: boolean | null; note: string | null;
  field: string | null; socials: string | null; results: number; ref_leads: number; ref_paid: number; contacts: number;
};
type History = Awaited<ReturnType<typeof graduateHistory>>;

const FILTERS = [
  { k: '', l: 'Hammasi' },
  { k: 'ish', l: 'Ishlayapti' },
  { k: 'frilans', l: 'Frilans' },
  { k: 'oqish', l: "O'qiyapti" },
  { k: 'nomalum', l: "Ma'lumot yo'q" },
  { k: 'aloqa', l: 'Aloqa kerak' },
];

export function GraduatesView({ rows, showIncome, contactDays, canAddResult }: { rows: GradRow[]; showIncome: boolean; contactDays: number; canAddResult: boolean }) {
  const [edit, setEdit] = useState<GradRow | null>(null);
  const [card, setCard] = useState<GradRow | null>(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const t = today();
  const due = (r: GradRow) => (r.next_contact_at ? r.next_contact_at <= t : !r.last_contact_at || daysBetween(r.last_contact_at, t) > contactDays);
  const kind = (r: GradRow) => (r.workplace ? 'ish' : r.freelance ? 'frilans' : r.studying_at ? 'oqish' : 'nomalum');
  const stats = useMemo(() => {
    const employed = rows.filter((r) => r.workplace || r.freelance).length;
    const incomes = rows.map((r) => r.monthly_income ?? 0).filter((x) => x > 0);
    return {
      employed,
      avg: incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0,
      refLeads: rows.reduce((a, r) => a + r.ref_leads + r.referrals, 0),
      refPaid: rows.reduce((a, r) => a + r.ref_paid, 0),
      due: rows.filter(due).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const count = (k: string) => (k === 'aloqa' ? stats.due : k ? rows.filter((r) => kind(r) === k).length : rows.length);
  const list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.workplace ?? '').toLowerCase().includes(q.toLowerCase())) && (!f || (f === 'aloqa' ? due(r) : kind(r) === f)));

  return (
    <>
      <PageHeader title="Bitiruvchilar" sub="Qayerda o'qiyapti, qayerda ishlayapti, qancha topyapti — aloqa uzilmasa, tanishlarini o'zlari yuboradi" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bitiruvchilar" value={String(rows.length)} />
        <Stat label="Ishlayapti yoki frilans" value={rows.length ? pct((stats.employed / rows.length) * 100) : '—'} hint={`${stats.employed} kishi`} tone="good" />
        {showIncome ? <Stat label="O'rtacha daromad" value={stats.avg ? money(stats.avg, false) : '—'} hint="so'm, oyiga" /> : <Stat label="Aloqa kerak" value={String(stats.due)} tone={stats.due ? 'warn' : 'neutral'} />}
        <Stat label="Tavsiya qilganlari" value={String(stats.refLeads)} hint={`${stats.refPaid} tasi o'quvchi bo'ldi`} />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki ish joyi bo'yicha" className="field pl-9" aria-label="Qidirish" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((x) => (
              <button key={x.k} onClick={() => setF(x.k)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', f === x.k ? 'border-ink bg-ink text-white' : 'border-line text-fg-muted hover:text-fg')}>
                {x.l} <span className="tnum opacity-70">{count(x.k)}</span>
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty icon={<GraduationCap className="h-5 w-5" />} title={rows.length ? 'Topilmadi' : "Hali bitiruvchi yo'q"} text={rows.length ? undefined : "O'quvchi kursni tugatganda uning holatini \"Bitirdi\" qiling, u shu yerga tushadi."} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                <button type="button" onClick={() => setCard(r)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold hover:text-brand">{r.name}</span>
                    {r.course && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="h-2 w-2 rounded-sm" style={{ background: r.color ?? '#8C9A97' }} /> {r.course}
                      </span>
                    )}
                    {r.field && <Badge>{r.field}</Badge>}
                    {due(r) && <Badge tone="warn">Aloqa kerak</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-fg-muted">
                    <Kind r={r} />
                    {showIncome && r.monthly_income ? <span className="font-semibold text-fg">{money(r.monthly_income)}/oy</span> : null}
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  {r.results > 0 && (
                    <Badge tone="brand">
                      <Medal className="mr-0.5 h-3 w-3" /> {r.results}
                    </Badge>
                  )}
                  {r.ref_leads + r.referrals > 0 && (
                    <Badge tone="good">
                      {r.ref_leads + r.referrals} tavsiya{r.ref_paid ? `, ${r.ref_paid} o'quvchi` : ''}
                    </Badge>
                  )}
                  <span>Aloqa: {fmtShort(r.last_contact_at)}</span>
                  {r.phone && (
                    <a href={`tel:+${r.phone}`} className="inline-flex h-8 items-center gap-1 rounded-field border border-line-strong px-2.5 font-semibold text-fg tnum hover:bg-canvas">
                      <Phone className="h-3.5 w-3.5" /> {phone(r.phone)}
                    </a>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setCard(r)}>
                    <MessageCircle className="h-3.5 w-3.5" /> Aloqa
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(r)} aria-label="Ma'lumotlarni yangilash">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {card && <GradCard r={card} onClose={() => setCard(null)} onEdit={() => setEdit(card)} contactDays={contactDays} showIncome={showIncome} canAddResult={canAddResult} />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Bitiruvchi ma'lumotlari" sub={edit?.name}>
        {edit && (
          <ActionForm action={saveGraduate.bind(null, edit.id)} onDone={() => setEdit(null)} onCancel={() => setEdit(null)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ish joyi">
                <input name="workplace" defaultValue={edit.workplace ?? ''} className="field" maxLength={120} />
              </Field>
              <Field label="Lavozimi">
                <input name="position" defaultValue={edit.position ?? ''} className="field" maxLength={120} />
              </Field>
              <Field label="Sohasi" hint="Masalan: Frontend, AI, SMM, Dizayn">
                <input name="field" defaultValue={edit.field ?? ''} className="field" maxLength={80} list="alumni-fields" />
                <datalist id="alumni-fields">
                  {['Frontend', 'Backend', 'Mobil dasturlash', "Sun'iy intellekt", 'Dizayn', 'SMM', 'YouTube', 'Kompyuter savodxonligi'].map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </Field>
              <Field label="O'qiyotgan joyi" hint="Universitet, litsey, xorij">
                <input name="studyingAt" defaultValue={edit.studying_at ?? ''} className="field" maxLength={160} />
              </Field>
              {showIncome && (
                <Field label="Oylik daromadi" hint="Faqat rahbar va administrator ko'radi">
                  <MoneyInput name="monthlyIncome" defaultValue={edit.monthly_income} />
                </Field>
              )}
              <Field label="Telegram / Instagram">
                <input name="socials" defaultValue={edit.socials ?? ''} className="field" maxLength={160} placeholder="@username" />
              </Field>
              <Field label="Keyingi aloqa sanasi">
                <input type="date" name="nextContactAt" defaultValue={edit.next_contact_at ?? ''} min={t} className="field" />
              </Field>
              <Field label="CRM dan tashqari tavsiyalar" hint="CRM da «Tavsiya» bilan kiritilganlar o'zi hisoblanadi">
                <input type="number" min={0} name="referrals" defaultValue={edit.referrals ?? 0} className="field" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="freelance" defaultChecked={!!edit.freelance} className="h-4 w-4 accent-[#0E7C6B]" /> Frilans zakazlar oladi
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="inTelegramGroup" defaultChecked={!!edit.in_telegram_group} className="h-4 w-4 accent-[#0E7C6B]" /> Bitiruvchilar guruhida
              </label>
            </div>
            <Field label="Izoh">
              <textarea name="note" defaultValue={edit.note ?? ''} rows={2} className="field" maxLength={600} />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}

function Kind({ r }: { r: GradRow }) {
  if (r.workplace)
    return (
      <span className="inline-flex items-center gap-1">
        <Briefcase className="h-3.5 w-3.5" /> {r.workplace}
        {r.position ? `, ${r.position}` : ''}
      </span>
    );
  if (r.freelance)
    return (
      <span className="inline-flex items-center gap-1">
        <Laptop className="h-3.5 w-3.5" /> Frilanser
      </span>
    );
  if (r.studying_at)
    return (
      <span className="inline-flex items-center gap-1">
        <School className="h-3.5 w-3.5" /> {r.studying_at}
      </span>
    );
  return <span>Hozir nima qilayotgani noma&apos;lum — so&apos;rab yozing</span>;
}

function GradCard({ r, onClose, onEdit, contactDays, showIncome, canAddResult }: { r: GradRow; onClose: () => void; onEdit: () => void; contactDays: number; showIncome: boolean; canAddResult: boolean }) {
  const [h, setH] = useState<History | null>(null);
  const [v, setV] = useState(0);
  const [win, setWin] = useState(false);
  useEffect(() => {
    let on = true;
    graduateHistory(r.id)
      .then((x) => on && setH(x))
      .catch(() => on && setH({ contacts: [], wins: [], refs: [] }));
    return () => {
      on = false;
    };
  }, [r.id, v]);
  const t = today();
  return (
    <Drawer open onClose={onClose} title={r.name} sub={[r.course, r.graduated_at && `bitirgan: ${fmtDate(r.graduated_at)}`].filter(Boolean).join(', ')}>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {r.phone && (
            <a href={`tel:+${r.phone}`} className="inline-flex h-9 items-center gap-2 rounded-field bg-brand px-3.5 text-[13px] font-bold text-white">
              <Phone className="h-4 w-4" /> {phone(r.phone)}
            </a>
          )}
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Ma&apos;lumotlar
          </Button>
          <Link href={`/oquvchilar?id=${r.id}&tab=natija`} className="inline-flex h-9 items-center rounded-field border border-line-strong px-3 text-[13px] font-semibold hover:bg-canvas">
            Profil
          </Link>
        </div>
        <div className="card grid grid-cols-2 gap-3 p-4 text-[13px]">
          <Info label="Ish joyi" value={r.workplace ? `${r.workplace}${r.position ? `, ${r.position}` : ''}` : r.freelance ? 'Frilanser' : '—'} />
          <Info label="O'qiyapti" value={r.studying_at ?? '—'} />
          {showIncome && <Info label="Daromadi" value={r.monthly_income ? `${money(r.monthly_income)}/oy` : '—'} />}
          <Info label="Sohasi" value={r.field ?? '—'} />
          <Info label="Ijtimoiy tarmoq" value={r.socials ?? '—'} />
          <Info label="Keyingi aloqa" value={r.next_contact_at ? fmtDate(r.next_contact_at) : r.last_contact_at ? fmtDate(addDays(r.last_contact_at, contactDays)) : 'hozir'} />
        </div>

        <div className="card p-4">
          <div className="mb-3 text-sm font-bold">Aloqani qayd etish</div>
          <ActionForm action={addGraduateContact.bind(null, r.id)} submitLabel="Qayd etish" resetOnSuccess onDone={() => setV((x) => x + 1)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qanday">
                <select name="channel" className="field" defaultValue="Qo'ng'iroq">
                  {ALUMNI_CHANNELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Qachon">
                <input type="date" name="date" defaultValue={t} max={t} className="field" />
              </Field>
            </div>
            <Field label="Nima gaplashildi">
              <textarea name="note" rows={2} className="field" maxLength={600} placeholder="Masalan: EPAM'ga stajyor bo'lib kirdi, ukasini olib keladi" />
            </Field>
            <Field label="Keyingi aloqa" hint={`Bo'sh qolsa — ${contactDays} kundan keyin eslatiladi`}>
              <input type="date" name="nextContactAt" min={t} className="field" />
            </Field>
          </ActionForm>
        </div>

        <div className="card divide-y divide-line">
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-bold">
            <span>Yutuqlari</span>
            {canAddResult && (
              <Button size="sm" variant="ghost" onClick={() => setWin(true)}>
                + Qo&apos;shish
              </Button>
            )}
          </div>
          {!h ? (
            <p className="px-4 py-3 text-sm text-fg-muted">Yuklanmoqda…</p>
          ) : h.wins.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">Ishga kirgani, sotgan loyihasi, Play Market ilovasi — yozib boring.</p>
          ) : (
            h.wins.map((w) => (
              <div key={w.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RESULT_META[w.type]?.color ?? '#8C9A97' }} />
                <span className="min-w-0 flex-1 truncate font-semibold">{w.title}</span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {w.type}, {fmtShort(w.date)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card divide-y divide-line">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
            <Users className="h-4 w-4 text-good" /> Tavsiya qilganlari
          </div>
          {!h ? null : h.refs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">Lid qo&apos;shishda «Tavsiya» tanlab, shu bitiruvchini belgilasangiz — shu yerda chiqadi.</p>
          ) : (
            h.refs.map((x) => (
              <Link key={x.id} href={`/lidlar?id=${x.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-canvas">
                <span className="font-semibold">{x.name}</span>
                <Badge tone={LEAD_STAGES.find((s) => s.key === x.stage)?.tone}>{LEAD_STAGES.find((s) => s.key === x.stage)?.label}</Badge>
              </Link>
            ))
          )}
        </div>

        <div className="card divide-y divide-line">
          <div className="px-4 py-2.5 text-sm font-bold">Aloqalar tarixi</div>
          {!h ? null : h.contacts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">Hali aloqa qayd etilmagan.</p>
          ) : (
            h.contacts.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="text-xs text-fg-muted">
                  {fmtDate(c.date)}, {c.channel}
                  {c.by ? `, ${c.by}` : ''}
                </div>
                {c.note && <p className="mt-1 text-sm">{c.note}</p>}
              </div>
            ))
          )}
        </div>
      </div>
      <Modal open={win} onClose={() => setWin(false)} title="Yutuq qo'shish" sub={r.name} size="sm">
        {win && (
          <ResultForm
            studentId={r.id}
            onDone={() => {
              setWin(false);
              setV((x) => x + 1);
            }}
          />
        )}
      </Modal>
    </Drawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}
