'use client';
import { Fragment, useState } from 'react';
import { BadgeCheck, Banknote, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { addAdjustment, deleteAdjustment, paySalary } from '@/app/actions/payroll';
import { money } from '@/lib/format';
import { fmtMonth, fmtShort } from '@/lib/dates';
import { ROLE_LABELS } from '@/lib/roles';
import type { Box } from './cashboxes';

export type PayRow = {
  userId: number;
  name: string;
  role: string;
  base: number;
  percent: number;
  collected: number;
  share: number;
  bonus: number;
  fine: number;
  advance: number;
  total: number;
  paid: { id: number; amount: number; at: string } | null;
  adjustments: { id: number; kind: string; amount: number; note: string | null; date: string }[];
};

const KIND = { bonus: { l: 'Bonus', tone: 'good' as const }, jarima: { l: 'Jarima', tone: 'bad' as const }, avans: { l: 'Avans', tone: 'info' as const } };

export function PayrollTab({ month, rows, boxes, salaryDay }: { month: string; rows: PayRow[]; boxes: Box[]; salaryDay: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [adj, setAdj] = useState<PayRow | null>(null);
  const [pay, setPay] = useState<PayRow | null>(null);
  const due = rows.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0);
  const paid = rows.reduce((s, r) => s + (r.paid?.amount ?? 0), 0);
  const adv = rows.reduce((s, r) => s + r.advance, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Oylik fondi" value={money(rows.reduce((s, r) => s + (r.paid?.amount ?? r.total) + r.advance, 0))} />
        <Mini label="Berilgan" value={money(paid + adv)} hint={adv ? `shundan avans ${money(adv)}` : undefined} />
        <Mini label="Berilishi kerak" value={money(due)} tone={due ? 'warn' : undefined} />
        <Mini label="Oylik kuni" value={`${salaryDay}-sana`} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={`${fmtMonth(month)} oyligi`} sub="Oklad + o'quvchilar to'lagan puldan ulush + bonus − jarima − avans. Ulush faqat haqiqatda tushgan pul bo'yicha." />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th className="th">Xodim</th>
                <th className="th text-right">Oklad</th>
                <th className="th text-right">Ulush</th>
                <th className="th text-right">Bonus</th>
                <th className="th text-right">Jarima</th>
                <th className="th text-right">Avans</th>
                <th className="th text-right">Beriladi</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <Fragment key={r.userId}>
                  <tr className="hover:bg-canvas/60">
                    <td className="td">
                      <button type="button" onClick={() => setOpen(open === r.userId ? null : r.userId)} className="flex items-center gap-1.5 text-left">
                        <ChevronDown className={cn('h-4 w-4 text-fg-muted transition-transform', open === r.userId && 'rotate-180')} />
                        <span>
                          <span className="block font-bold">{r.name}</span>
                          <span className="block text-xs text-fg-muted">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span>
                        </span>
                      </button>
                    </td>
                    <td className="td text-right tnum">{money(r.base)}</td>
                    <td className="td text-right tnum">
                      {r.percent ? (
                        <>
                          {money(r.share)}
                          <div className="text-[11px] text-fg-muted">
                            {r.percent}% × {money(r.collected)}
                          </div>
                        </>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="td text-right tnum text-good">{r.bonus ? `+${money(r.bonus)}` : '—'}</td>
                    <td className="td text-right tnum text-bad">{r.fine ? `−${money(r.fine)}` : '—'}</td>
                    <td className="td text-right tnum">{r.advance ? `−${money(r.advance)}` : '—'}</td>
                    <td className="td text-right font-extrabold tnum">{money(r.paid?.amount ?? r.total)}</td>
                    <td className="td whitespace-nowrap text-right">
                      {r.paid ? (
                        <Badge tone="good">
                          <BadgeCheck className="h-3.5 w-3.5" /> {fmtShort(r.paid.at)} berildi
                        </Badge>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setAdj(r)}>
                            <Plus className="h-4 w-4" /> Tuzatish
                          </Button>
                          <Button size="sm" onClick={() => setPay(r)} disabled={r.total <= 0}>
                            <Banknote className="h-4 w-4" /> Berish
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {open === r.userId && (
                    <tr className="bg-canvas/40">
                      <td colSpan={8} className="px-5 py-3">
                        {r.adjustments.length === 0 ? (
                          <p className="text-[13px] text-fg-muted">Bu oyda bonus, jarima yoki avans yo&apos;q.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {r.adjustments.map((a) => (
                              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                                <span className="w-12 text-fg-muted tnum">{fmtShort(a.date)}</span>
                                <Badge tone={KIND[a.kind as keyof typeof KIND]?.tone}>{KIND[a.kind as keyof typeof KIND]?.l ?? a.kind}</Badge>
                                <span className="font-bold tnum">{money(a.amount)}</span>
                                <span className="min-w-0 flex-1 truncate text-fg-muted">{a.note}</span>
                                {!r.paid && (
                                  <ActionButton variant="ghost" size="icon" action={() => deleteAdjustment(a.id)} confirm={a.kind === 'avans' ? "Avans o'chirilsa, kassadagi chiqim ham o'chadi. Davom etasizmi?" : "O'chirilsinmi?"} title="O'chirish">
                                    <Trash2 className="h-4 w-4" />
                                  </ActionButton>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-fg-muted">Faol xodim yo&apos;q</p>}
      </Card>
      <p className="text-xs text-fg-muted">Oklad va ulush foizi Xodimlar bo&apos;limida, har bir xodim kartasida belgilanadi.</p>

      <Modal open={!!adj} onClose={() => setAdj(null)} title="Bonus, jarima yoki avans" sub={adj ? `${adj.name}, ${fmtMonth(month).toLowerCase()}` : undefined} size="sm">
        {adj && <AdjForm r={adj} month={month} boxes={boxes} onDone={() => setAdj(null)} />}
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title="Oylikni berish" sub={pay ? pay.name : undefined} size="sm">
        {pay && (
          <ActionForm action={paySalary.bind(null, pay.userId, month)} onDone={() => setPay(null)} onCancel={() => setPay(null)} submitLabel={`${money(pay.total)} berish`}>
            <dl className="space-y-1.5 rounded-xl border border-line p-4 text-sm tnum">
              <Line l="Oklad" v={pay.base} />
              {pay.percent > 0 && <Line l={`Ulush (${pay.percent}% × ${money(pay.collected)})`} v={pay.share} />}
              {pay.bonus > 0 && <Line l="Bonus" v={pay.bonus} />}
              {pay.fine > 0 && <Line l="Jarima" v={-pay.fine} />}
              {pay.advance > 0 && <Line l="Avans (berilgan)" v={-pay.advance} />}
              <div className="flex justify-between border-t border-line pt-2 font-extrabold">
                <span>Beriladi</span>
                <span>{money(pay.total)}</span>
              </div>
            </dl>
            <BoxMethod boxes={boxes} />
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}

function AdjForm({ r, month, boxes, onDone }: { r: PayRow; month: string; boxes: Box[]; onDone: () => void }) {
  const [kind, setKind] = useState<'bonus' | 'jarima' | 'avans'>('bonus');
  return (
    <ActionForm action={addAdjustment.bind(null, r.userId, month)} onDone={onDone} onCancel={onDone}>
      <Field label="Turi">
        <div className="flex gap-1.5">
          {(['bonus', 'jarima', 'avans'] as const).map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">{KIND[k].l}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Summa">
        <MoneyInput name="amount" required />
      </Field>
      <Field label="Izoh">
        <input name="note" className="field" maxLength={200} placeholder={kind === 'jarima' ? 'Masalan: darsga 3 marta kechikdi' : kind === 'bonus' ? "Masalan: guruh to'liq to'ladi" : ''} />
      </Field>
      {kind === 'avans' && <BoxMethod boxes={boxes} />}
    </ActionForm>
  );
}

function BoxMethod({ boxes }: { boxes: Box[] }) {
  const main = boxes.find((b) => b.isMain);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Qaysi kassadan">
        <select name="cashboxId" defaultValue={main?.id} className="field">
          {boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Usul">
        <select name="method" defaultValue="naqd" className="field">
          <option value="naqd">Naqd</option>
          <option value="karta">Karta</option>
          <option value="bank">Bank</option>
        </select>
      </Field>
    </div>
  );
}

function Line({ l, v }: { l: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-muted">{l}</span>
      <span className={v < 0 ? 'text-bad' : ''}>
        {v < 0 ? '−' : ''}
        {money(Math.abs(v))}
      </span>
    </div>
  );
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1 text-lg font-extrabold tnum', tone === 'warn' && 'text-warn')}>{value}</div>
      {hint && <div className="text-[11px] text-fg-muted">{hint}</div>}
    </div>
  );
}
