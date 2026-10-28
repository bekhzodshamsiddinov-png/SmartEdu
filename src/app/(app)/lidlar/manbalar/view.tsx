'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2, Trophy, Timer, Wallet } from 'lucide-react';
import { Button, Card, CardHeader, Field, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { deleteAdSpend, saveAdSpend } from '@/app/actions/leads';
import { LEAD_SOURCES, SOURCE_COLOR } from '@/lib/constants';
import { money, pct } from '@/lib/format';
import { addMonths, fmtMonth } from '@/lib/dates';

export type SrcRow = { source: string; campaign: string | null; ad: string | null; leads: number; contacted: number; trial: number; came: number; paid: number; lost: number; open: number };
type Agg = Omit<SrcRow, 'source' | 'campaign' | 'ad'> & { spend: number };
const color = (s: string) => SOURCE_COLOR[s] ?? '#8C9A97';
const zero = (): Agg => ({ leads: 0, contacted: 0, trial: 0, came: 0, paid: 0, lost: 0, open: 0, spend: 0 });
const add = (a: Agg, r: SrcRow) => {
  a.leads += r.leads;
  a.contacted += r.contacted;
  a.trial += r.trial;
  a.came += r.came;
  a.paid += r.paid;
  a.lost += r.lost;
  a.open += r.open;
};
const rate = (n: number, d: number) => (d ? (n / d) * 100 : 0);
const mins = (m: number | null | undefined) => (m == null ? '—' : m < 60 ? `${Math.round(m)} daq` : m < 1440 ? `${(m / 60).toFixed(1)} soat` : `${(m / 1440).toFixed(1)} kun`);

export function SourcesView({
  month,
  span,
  rows,
  repeats,
  spend,
  speed,
  daily,
  spendRows,
  canSpend,
  from,
  to,
}: {
  month: string;
  span: number;
  rows: SrcRow[];
  repeats: Record<string, number>;
  spend: { source: string; campaign: string; amount: number }[];
  speed: Record<string, number | null>;
  daily: { d: string; source: string; c: number }[];
  spendRows: { id: number; month: string; source: string; campaign: string; amount: number; note: string | null; branch: string | null }[];
  canSpend: boolean;
  from: string;
  to: string;
}) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [spendModal, setSpendModal] = useState(false);
  const data = useMemo(() => {
    const bySrc = new Map<string, Agg & { camps: Map<string, Agg & { ads: Map<string, Agg> }> }>();
    for (const r of rows) {
      const s = bySrc.get(r.source) ?? { ...zero(), camps: new Map() };
      add(s, r);
      const ck = r.campaign ?? '';
      const c = s.camps.get(ck) ?? { ...zero(), ads: new Map() };
      add(c, r);
      const ak = r.ad ?? '';
      const a = c.ads.get(ak) ?? zero();
      add(a, r);
      c.ads.set(ak, a);
      s.camps.set(ck, c);
      bySrc.set(r.source, s);
    }
    for (const sp of spend) {
      const s = bySrc.get(sp.source) ?? { ...zero(), camps: new Map() };
      s.spend += sp.amount;
      const c = s.camps.get(sp.campaign) ?? { ...zero(), ads: new Map() };
      c.spend += sp.amount;
      s.camps.set(sp.campaign, c);
      bySrc.set(sp.source, s);
    }
    const list = [...bySrc.entries()].sort((a, b) => b[1].leads - a[1].leads);
    const total = list.reduce((t, [, v]) => {
      t.leads += v.leads;
      t.paid += v.paid;
      t.trial += v.trial;
      t.came += v.came;
      t.spend += v.spend;
      return t;
    }, zero());
    // Eng yaxshi reklamalar: kamida 3 lid, to'lov foizi bo'yicha
    const ads = rows
      .filter((r) => r.campaign || r.ad)
      .map((r) => ({ ...r, conv: rate(r.paid, r.leads) }))
      .filter((r) => r.leads >= 3)
      .sort((a, b) => b.conv - a.conv || b.paid - a.paid)
      .slice(0, 5);
    return { list, total, ads };
  }, [rows, spend]);

  const days = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const r of daily) {
      const x = m.get(r.d) ?? new Map();
      x.set(r.source, r.c);
      m.set(r.d, x);
    }
    const out: { d: string; parts: { s: string; c: number }[]; total: number }[] = [];
    for (let d = from; d <= to; d = next(d)) {
      const x = m.get(d) ?? new Map();
      const parts = [...x.entries()].map(([s, c]) => ({ s, c })).sort((a, b) => b.c - a.c);
      out.push({ d, parts, total: parts.reduce((a, b) => a + b.c, 0) });
      if (out.length > 400) break;
    }
    return out;
  }, [daily, from, to]);
  const maxDay = Math.max(1, ...days.map((d) => d.total));
  const t = data.total;

  return (
    <>
      <Link href="/lidlar" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Lidlar
      </Link>
      <PageHeader
        title="Manbalar hisoboti"
        sub="Qaysi kanal va qaysi reklama o'quvchi olib kelyapti"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-field border border-line bg-white p-1">
              {[1, 3, 6, 12].map((n) => (
                <Link key={n} href={`/lidlar/manbalar?oy=${month}&oylar=${n}`} className={cn('rounded-[7px] px-3 py-1.5 text-[13px] font-bold', span === n ? 'bg-ink text-white' : 'text-fg-muted hover:text-fg')}>
                  {n === 1 ? '1 oy' : `${n} oy`}
                </Link>
              ))}
            </div>
            <div className="inline-flex items-center rounded-field border border-line bg-white">
              <Link href={`/lidlar/manbalar?oy=${addMonths(month, -1)}&oylar=${span}`} className="px-3 py-2 text-sm font-bold text-fg-muted hover:text-fg" aria-label="Oldingi oy">
                ‹
              </Link>
              <span className="px-1 text-[13px] font-bold">{span === 1 ? fmtMonth(month) : `${fmtMonth(addMonths(month, -(span - 1)))} – ${fmtMonth(month)}`}</span>
              <Link href={`/lidlar/manbalar?oy=${addMonths(month, 1)}&oylar=${span}`} className="px-3 py-2 text-sm font-bold text-fg-muted hover:text-fg" aria-label="Keyingi oy">
                ›
              </Link>
            </div>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Lidlar" value={String(t.leads)} />
        <Stat label="Sinovga keldi" value={String(t.came)} hint={t.leads ? pct(rate(t.came, t.leads)) : undefined} />
        <Stat label="O'quvchi bo'ldi" value={String(t.paid)} hint={t.leads ? `konversiya ${pct(rate(t.paid, t.leads))}` : undefined} tone="good" />
        <Stat label="Reklama xarajati" value={t.spend ? money(t.spend, false) : '—'} hint="so'm" />
        <Stat label="Bir lid narxi" value={t.spend && t.leads ? money(t.spend / t.leads, false) : '—'} hint="so'm" />
        <Stat label="Bir o'quvchi narxi" value={t.spend && t.paid ? money(t.spend / t.paid, false) : '—'} hint="so'm" />
      </div>

      <Card className="mb-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">Kunlar bo&apos;yicha lidlar</h2>
          <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
            {data.list.slice(0, 7).map(([s]) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(s) }} /> {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Kunlik lidlar soni, kanallar bo'yicha">
          {days.map((d) => (
            <div key={d.d} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.d}: ${d.total} lid${d.parts.length ? ' — ' + d.parts.map((p) => `${p.s} ${p.c}`).join(', ') : ''}`}>
              {d.parts.map((p) => (
                <div key={p.s} style={{ height: `${(p.c / maxDay) * 100}%`, background: color(p.s) }} className="w-full first:rounded-t-[3px]" />
              ))}
              {d.total === 0 && <div className="h-[2px] w-full rounded bg-line" />}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-2xs text-fg-faint tnum">
          <span>{days[0]?.d.slice(5).split('-').reverse().join('.')}</span>
          <span>{days.at(-1)?.d.slice(5).split('-').reverse().join('.')}</span>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Kanallar" sub="Lid birinchi kelgan kanaliga yoziladi. Ustiga bosing — kampaniya va reklamalar ochiladi." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-y border-line bg-canvas/60 text-left text-xs font-bold text-fg-muted">
              <tr>
                <th className="px-5 py-2.5">Kanal</th>
                <th className="px-3 py-2.5 text-right">Lid</th>
                <th className="px-3 py-2.5 text-right">Qayta</th>
                <th className="px-3 py-2.5 text-right">Bog&apos;lanildi</th>
                <th className="px-3 py-2.5 text-right">Sinovga keldi</th>
                <th className="px-3 py-2.5 text-right">O&apos;quvchi</th>
                <th className="px-3 py-2.5 text-right">Konversiya</th>
                <th className="px-3 py-2.5 text-right">1-qo&apos;ng&apos;iroq</th>
                <th className="px-3 py-2.5 text-right">Xarajat</th>
                <th className="px-5 py-2.5 text-right">O&apos;quvchi narxi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.list.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-fg-muted">
                    Bu davrda lid yo&apos;q.
                  </td>
                </tr>
              )}
              {data.list.map(([s, v]) => {
                const open = openSrc === s;
                const camps = [...v.camps.entries()].filter(([k]) => k).sort((a, b) => b[1].leads - a[1].leads);
                return (
                  <Fragment key={s}>
                    <tr className={cn('cursor-pointer hover:bg-canvas/60', open && 'bg-canvas/60')} onClick={() => setOpenSrc(open ? null : s)}>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 font-bold">
                          {camps.length ? open ? <ChevronDown className="h-4 w-4 text-fg-faint" /> : <ChevronRight className="h-4 w-4 text-fg-faint" /> : <span className="w-4" />}
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(s) }} /> {s}
                        </span>
                      </td>
                      <Num v={v.leads} b />
                      <Num v={repeats[s] ?? 0} muted />
                      <Num v={v.contacted} />
                      <Num v={v.came} />
                      <Num v={v.paid} b />
                      <td className="px-3 py-3 text-right">
                        <ConvBar v={rate(v.paid, v.leads)} />
                      </td>
                      <td className={cn('px-3 py-3 text-right tnum', (speed[s] ?? 0) > 60 && 'font-semibold text-warn')}>{mins(speed[s])}</td>
                      <td className="px-3 py-3 text-right tnum">{v.spend ? money(v.spend, false) : '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold tnum">{v.spend && v.paid ? money(v.spend / v.paid, false) : '—'}</td>
                    </tr>
                    {open &&
                      camps.map(([c, cv]) => (
                        <Fragment key={c}>
                          <tr className="bg-canvas/30 text-fg">
                            <td className="py-2 pl-14 pr-3 font-semibold">{c}</td>
                            <Num v={cv.leads} />
                            <td />
                            <Num v={cv.contacted} />
                            <Num v={cv.came} />
                            <Num v={cv.paid} b />
                            <td className="px-3 py-2 text-right">
                              <ConvBar v={rate(cv.paid, cv.leads)} />
                            </td>
                            <td />
                            <td className="px-3 py-2 text-right tnum">{cv.spend ? money(cv.spend, false) : '—'}</td>
                            <td className="px-5 py-2 text-right tnum">{cv.spend && cv.leads ? <span title="bir lid narxi">{money(cv.spend / cv.leads, false)} / lid</span> : '—'}</td>
                          </tr>
                          {[...cv.ads.entries()]
                            .filter(([a]) => a)
                            .sort((a, b) => b[1].leads - a[1].leads)
                            .map(([a, av]) => (
                              <tr key={a} className="bg-canvas/30 text-fg-muted">
                                <td className="py-1.5 pl-20 pr-3">{a}</td>
                                <Num v={av.leads} />
                                <td />
                                <Num v={av.contacted} />
                                <Num v={av.came} />
                                <Num v={av.paid} />
                                <td className="px-3 py-1.5 text-right text-xs tnum">{pct(rate(av.paid, av.leads))}</td>
                                <td colSpan={3} />
                              </tr>
                            ))}
                        </Fragment>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4 text-warn" /> Eng yaxshi reklamalar</span>} sub="Kamida 3 lid kelgan, o'quvchiga aylanish foizi bo'yicha" />
          {data.ads.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-fg-muted">Reklama nomi bilan kelgan lidlar hali kam. Instagram formasi ulansa yoki reklama havolasi ishlatilsa, shu yerda solishtiriladi.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {data.ads.map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-canvas text-xs font-extrabold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{[a.campaign, a.ad].filter(Boolean).join(' · ')}</div>
                    <div className="text-xs text-fg-muted">{a.source}</div>
                  </div>
                  <span className="shrink-0 text-right text-xs text-fg-muted tnum">
                    {a.leads} lid → <b className="text-fg">{a.paid}</b> o&apos;quvchi
                  </span>
                  <span className="w-12 shrink-0 text-right font-extrabold text-good tnum">{pct(a.conv)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-start gap-2 border-t border-line px-5 py-3 text-xs text-fg-muted">
            <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" /> «1-qo&apos;ng&apos;iroq» — lid tushgandan sotuvchi birinchi qo&apos;ng&apos;iroqni qayd etgunicha o&apos;tgan vaqt (median). 15 daqiqadan oshmasin.
          </div>
        </Card>

        <Card>
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-brand" /> Reklama xarajatlari</span>}
            sub="Oy, kanal va kampaniya bo'yicha — lid va o'quvchi narxi shundan hisoblanadi"
            action={
              canSpend && (
                <Button size="sm" onClick={() => setSpendModal(true)}>
                  <Plus className="h-4 w-4" /> Kiritish
                </Button>
              )
            }
          />
          {spendRows.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-fg-muted">Bu davr uchun xarajat kiritilmagan.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {spendRows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(r.source) }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {r.source}
                      {r.campaign ? ` · ${r.campaign}` : ''}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {fmtMonth(r.month)}
                      {r.branch ? `, ${r.branch}` : ''}
                      {r.note ? `, ${r.note}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 font-bold tnum">{money(r.amount)}</span>
                  {canSpend && (
                    <ActionButton size="icon" variant="ghost" action={() => deleteAdSpend(r.id)} confirm="Xarajat o'chirilsinmi?" title="O'chirish">
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={spendModal} onClose={() => setSpendModal(false)} title="Reklama xarajati" size="sm">
        <ActionForm action={saveAdSpend} onDone={() => setSpendModal(false)} onCancel={() => setSpendModal(false)}>
          <Field label="Oy">
            <input type="month" name="month" defaultValue={month} className="field" required />
          </Field>
          <Field label="Kanal">
            <select name="source" defaultValue="Instagram target" className="field" required>
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Kampaniya" hint="Bo'sh qoldirsangiz — butun kanal uchun">
            <input name="campaign" list="spend-camps" className="field" maxLength={120} />
            <datalist id="spend-camps">
              {[...new Set(rows.map((r) => r.campaign).filter(Boolean))].map((c) => (
                <option key={c!} value={c!} />
              ))}
            </datalist>
          </Field>
          <Field label="Summa, so'm">
            <MoneyInput name="amount" required />
          </Field>
          <Field label="Izoh">
            <input name="note" className="field" maxLength={200} placeholder="Masalan: $50, 7 kun" />
          </Field>
        </ActionForm>
      </Modal>
    </>
  );
}

function next(d: string) {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

function Num({ v, b, muted }: { v: number; b?: boolean; muted?: boolean }) {
  return <td className={cn('px-3 py-2.5 text-right tnum', b && 'font-bold', muted && 'text-fg-muted')}>{v || (muted ? '—' : 0)}</td>;
}

function ConvBar({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line sm:inline-block">
        <span className="block h-full rounded-full bg-good" style={{ width: `${Math.min(100, v)}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tnum">{pct(v)}</span>
    </span>
  );
}
