'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash2, Pencil, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { MoneyBars } from '@/components/charts/money-bars';
import { deleteTransaction, saveReconciliation, saveTransaction } from '@/app/actions/finance';
import { money } from '@/lib/format';
import { addMonths, fmtMonth, fmtShort, thisMonth, today } from '@/lib/dates';

const EXPENSE = ['Oylik', 'Ijara', 'Kommunal va internet', 'Marketing', 'Jihozlar', 'Soliqlar', 'Boshqa'];
const INCOME = ['Boshqa daromad', 'Grant', 'Xizmat (zakaz)', 'Investitsiya'];
const RECON = [
  { key: 'kirim', label: 'Kirim' },
  { key: 'oylik', label: 'Oylik fondi' },
  { key: 'ijara', label: 'Ijara' },
  { key: 'kommunal', label: 'Kommunal va internet' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'soliq', label: "To'langan soliqlar" },
  { key: 'boshqa', label: 'Boshqa xarajatlar' },
];
const METHODS = [
  { k: 'bank', l: 'Bank hisobi' },
  { k: 'naqd', l: 'Naqd (kassa)' },
  { k: 'karta', l: 'Karta' },
];

type Tx = { id: number; type: 'kirim' | 'chiqim'; category: string; amount: number; date: string; method: string; counterparty: string | null; document: string | null; note: string | null; by: string | null };

export function FinanceView({
  month,
  tx,
  ie,
  rec,
  system,
  byCourse,
  byCat,
  series,
  reservePercent,
  payMethods,
  tab,
  openNew,
  isBoss,
}: {
  month: string;
  tx: Tx[];
  ie: { tuition: number; otherIncome: number; income: number; expense: number; profit: number };
  rec: { bank: Record<string, number>; tax: Record<string, number>; note: string | null } | null;
  system: Record<string, number>;
  byCourse: { name: string; color: string; s: number }[];
  byCat: { category: string; s: number }[];
  series: { label: string; kirim: number; xarajat: number }[];
  reservePercent: number;
  payMethods: Record<string, number>;
  tab: 'jurnal' | 'solishtirma' | 'tahlil';
  openNew: boolean;
  isBoss: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [edit, setEdit] = useState<Tx | 'chiqim' | 'kirim' | null>(openNew ? 'chiqim' : null);
  useEffect(() => setEdit(openNew ? 'chiqim' : null), [openNew]);
  const link = (q: Record<string, string>) => `${path}?${new URLSearchParams({ oy: month, tab, ...q }).toString()}`;
  const close = () => (openNew ? router.push(link({})) : setEdit(null));
  const reserve = Math.round((ie.income * reservePercent) / 100);
  const noDoc = tx.filter((t) => t.type === 'chiqim' && !t.document).length;

  const exportCsv = () => {
    const rows = [['Sana', 'Turi', 'Toifa', 'Summa', 'Usul', 'Kontragent', 'Hujjat', 'Izoh'], ...tx.map((t) => [t.date, t.type, t.category, t.amount, t.method, t.counterparty ?? '', t.document ?? '', t.note ?? ''])];
    const csv = rows.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `moliya-${month}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader
        title="Moliya"
        sub="Kirim, xarajat va bank hamda soliq bilan oylik solishtirma"
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdit('kirim')}>
              <Plus className="h-4 w-4" /> Kirim
            </Button>
            <Button onClick={() => setEdit('chiqim')}>
              <Plus className="h-4 w-4" /> Xarajat kiritish
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-field border border-line bg-white p-1">
          {[
            { k: 'jurnal', l: 'Kirim-chiqim' },
            { k: 'solishtirma', l: 'Oylik solishtirma' },
            { k: 'tahlil', l: 'Tahlil' },
          ].map((t) => (
            <Link key={t.k} href={`${path}?oy=${month}&tab=${t.k}`} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === t.k ? 'bg-ink text-white' : 'text-fg-muted')}>
              {t.l}
            </Link>
          ))}
        </div>
        <div className="card flex items-center self-start">
          <Button size="icon" variant="ghost" onClick={() => router.push(link({ oy: addMonths(month, -1) }))} aria-label="Oldingi oy">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[130px] text-center text-[13px] font-bold">{fmtMonth(month)}</span>
          <Button size="icon" variant="ghost" onClick={() => router.push(link({ oy: addMonths(month, 1) }))} disabled={month >= thisMonth()} aria-label="Keyingi oy">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kirim" value={money(ie.income, false)} hint={`O'quvchilardan ${money(ie.tuition)}`} />
        <Stat label="Xarajat" value={money(ie.expense, false)} hint="so'm" />
        <Stat label="Sof foyda" value={money(ie.profit, false)} tone={ie.profit >= 0 ? 'good' : 'bad'} hint={ie.income ? `Rentabellik ${Math.round((ie.profit / ie.income) * 100)}%` : "so'm"} />
        <Stat label={`Zaxiraga (${reservePercent}%)`} value={money(reserve, false)} hint="Alohida hisobga o'tkazing" />
      </div>

      {tab === 'jurnal' && (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="text-[13px] text-fg-muted">
              {noDoc > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-warn">
                  <AlertTriangle className="h-4 w-4" /> {noDoc} ta xarajatda hujjat raqami yo&apos;q
                </span>
              ) : (
                tx.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-good">
                    <CheckCircle2 className="h-4 w-4" /> Barcha xarajatlar hujjatli
                  </span>
                )
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className="th">Sana</th>
                  <th className="th">Toifa</th>
                  <th className="th">Kontragent, hujjat</th>
                  <th className="th">Usul</th>
                  <th className="th text-right">Summa</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr className="bg-brand-soft/40">
                  <td className="td text-fg-muted">{fmtMonth(month)}</td>
                  <td className="td font-bold">O&apos;quvchilar to&apos;lovlari</td>
                  <td className="td text-[13px] text-fg-muted">
                    {Object.entries(payMethods)
                      .map(([k, v]) => `${{ naqd: 'Naqd', click: 'Click', payme: 'Payme', karta: 'Karta', bank: 'Bank' }[k] ?? k}: ${money(v)}`)
                      .join(', ') || "To'lovlar bo'limidan avtomatik"}
                  </td>
                  <td className="td">
                    <Badge tone="brand">Avtomatik</Badge>
                  </td>
                  <td className="td text-right font-bold text-good tnum">+{money(ie.tuition)}</td>
                  <td className="td" />
                </tr>
                {tx.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas/60">
                    <td className="td text-fg-muted">{fmtShort(t.date)}</td>
                    <td className="td">
                      <div className="font-bold">{t.category}</div>
                      {t.note && <div className="text-xs text-fg-muted">{t.note}</div>}
                    </td>
                    <td className="td text-[13px]">
                      {t.counterparty ?? '—'}
                      {t.document ? <div className="text-xs text-fg-muted">{t.document}</div> : t.type === 'chiqim' && <div className="text-xs font-semibold text-warn">Hujjatsiz</div>}
                    </td>
                    <td className="td text-[13px] text-fg-muted">{METHODS.find((m) => m.k === t.method)?.l ?? t.method}</td>
                    <td className={cn('td text-right font-bold tnum', t.type === 'kirim' ? 'text-good' : 'text-fg')}>
                      {t.type === 'kirim' ? '+' : '−'}
                      {money(t.amount)}
                    </td>
                    <td className="td whitespace-nowrap text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEdit(t)} aria-label="Tahrirlash">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isBoss && (
                        <ActionButton variant="ghost" size="icon" action={() => deleteTransaction(t.id)} confirm="Yozuv o'chirilsinmi?" title="O'chirish">
                          <Trash2 className="h-4 w-4" />
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tx.length === 0 && <Empty icon={<Receipt className="h-5 w-5" />} title="Bu oyda xarajat kiritilmagan" text="Ijara, oylik, internet, target — har bir chiqimni hujjati bilan kiriting." />}
        </Card>
      )}

      {tab === 'solishtirma' && <Reconciliation month={month} system={system} rec={rec} />}

      {tab === 'tahlil' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader title="Oxirgi 6 oy" sub="Kirim va xarajat, so'm" />
            <div className="px-3 pb-4 sm:px-5">
              <MoneyBars data={series} height={240} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Kirim yo'nalishlar bo'yicha" sub={fmtMonth(month)} />
            <BarList items={byCourse.map((c) => ({ label: c.name, value: c.s, color: c.color }))} empty="Bu oyda to'lov yo'q" />
          </Card>
          <Card>
            <CardHeader title="Xarajatlar toifalar bo'yicha" sub={fmtMonth(month)} />
            <BarList items={byCat.map((c) => ({ label: c.category, value: c.s, color: '#C2862A' }))} empty="Bu oyda xarajat yo'q" />
          </Card>
        </div>
      )}

      <Modal open={!!edit} onClose={close} title={edit === 'kirim' ? 'Boshqa kirim' : edit === 'chiqim' ? 'Xarajat kiritish' : 'Yozuvni tahrirlash'} sub={edit === 'kirim' ? "O'quvchi to'lovlari To'lovlar bo'limida kiritiladi" : undefined}>
        {edit && <TxForm t={typeof edit === 'object' ? edit : null} type={typeof edit === 'object' ? edit.type : edit} onDone={close} />}
      </Modal>
    </>
  );
}

function TxForm({ t, type, onDone }: { t: Tx | null; type: 'kirim' | 'chiqim'; onDone: () => void }) {
  const cats = type === 'kirim' ? INCOME : EXPENSE;
  return (
    <ActionForm action={saveTransaction.bind(null, t?.id ?? null)} onDone={onDone} onCancel={onDone}>
      <input type="hidden" name="type" value={type} />
      <Field label="Toifa">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="category" value={c} defaultChecked={t ? t.category === c : i === 0} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">{c}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Summa">
          <MoneyInput name="amount" defaultValue={t?.amount} required />
        </Field>
        <Field label="Sana">
          <input type="date" name="date" defaultValue={t?.date ?? today()} className="field" />
        </Field>
        <Field label="Qayerdan to'landi">
          <select name="method" defaultValue={t?.method ?? 'bank'} className="field">
            {METHODS.map((m) => (
              <option key={m.k} value={m.k}>
                {m.l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontragent">
          <input name="counterparty" defaultValue={t?.counterparty ?? ''} className="field" placeholder="Masalan: Ijara beruvchi, Uztelecom" />
        </Field>
      </div>
      <Field label="Hujjat" hint="Shartnoma, hisob-faktura yoki chek raqami. Soliq solishtirmasi uchun muhim.">
        <input name="document" defaultValue={t?.document ?? ''} className="field" placeholder="Masalan: Shartnoma No 12, hisob-faktura 0045" />
      </Field>
      <Field label="Izoh">
        <input name="note" defaultValue={t?.note ?? ''} className="field" />
      </Field>
    </ActionForm>
  );
}

function Reconciliation({ month, system, rec }: { month: string; system: Record<string, number>; rec: { bank: Record<string, number>; tax: Record<string, number>; note: string | null } | null }) {
  const [bank, setBank] = useState<Record<string, string>>({});
  const [tax, setTax] = useState<Record<string, string>>({});
  useEffect(() => {
    setBank(Object.fromEntries(Object.entries(rec?.bank ?? {}).map(([k, v]) => [k, String(v)])));
    setTax(Object.fromEntries(Object.entries(rec?.tax ?? {}).map(([k, v]) => [k, String(v)])));
  }, [rec, month]);
  const num = (s?: string) => (s ? Number(s.replace(/\D/g, '')) : null);
  const fmt = (v: string) => v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const totalExp = (src: Record<string, number | null>) => RECON.slice(1).reduce((s, r) => s + (src[r.key] ?? 0), 0);
  const sysProfit = system.kirim - totalExp(system);
  const bankVals = Object.fromEntries(RECON.map((r) => [r.key, num(bank[r.key])]));
  const taxVals = Object.fromEntries(RECON.map((r) => [r.key, num(tax[r.key])]));
  let issues = 0;
  const diffCell = (sys: number, other: number | null) => {
    if (other === null) return <td className="td text-right text-fg-faint">—</td>;
    const d = other - sys;
    if (d !== 0) issues++;
    return <td className={cn('td text-right font-bold tnum', d === 0 ? 'text-good' : 'bg-bad-soft text-bad')}>{d === 0 ? '0' : money(d, false)}</td>;
  };
  const rows = RECON.map((r) => {
    const sys = system[r.key] ?? 0;
    return (
      <tr key={r.key}>
        <td className="td font-semibold">{r.label}</td>
        <td className="td text-right font-bold tnum">{money(sys, false)}</td>
        <td className="td p-1.5">
          <input name={`bank_${r.key}`} value={bank[r.key] ? fmt(bank[r.key]) : ''} onChange={(e) => setBank((b) => ({ ...b, [r.key]: e.target.value }))} inputMode="numeric" className="field h-9 text-right tnum" placeholder="—" aria-label={`Bank: ${r.label}`} />
        </td>
        {diffCell(sys, bankVals[r.key])}
        <td className="td p-1.5">
          <input name={`tax_${r.key}`} value={tax[r.key] ? fmt(tax[r.key]) : ''} onChange={(e) => setTax((b) => ({ ...b, [r.key]: e.target.value }))} inputMode="numeric" className="field h-9 text-right tnum" placeholder="—" aria-label={`Soliq: ${r.label}`} />
        </td>
        {diffCell(sys, taxVals[r.key])}
      </tr>
    );
  });
  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-bold">{fmtMonth(month)} solishtirmasi</h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-fg-muted">
          Bugalter har oyning 5-sanasigacha bank ko&apos;chirmasi va soliq hisobotidagi raqamlarni kiritadi. Farq 0 bo&apos;lmasa, sababini topib tuzatmaguncha hisobot topshirilmaydi.
        </p>
      </div>
      <ActionForm action={saveReconciliation.bind(null, month)} submitLabel="Solishtirmani saqlash" className="pb-4 [&>div:last-child]:px-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th className="th">Ko&apos;rsatkich</th>
                <th className="th text-right">SmartEdu</th>
                <th className="th w-44 text-right">Bank</th>
                <th className="th text-right">Farq</th>
                <th className="th w-44 text-right">Soliq hisoboti</th>
                <th className="th text-right">Farq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows}
              <tr className="bg-canvas/60">
                <td className="td font-extrabold">Sof foyda</td>
                <td className={cn('td text-right font-extrabold tnum', sysProfit < 0 && 'text-bad')}>{money(sysProfit, false)}</td>
                <td className="td text-right font-bold tnum">{bankVals.kirim !== null ? money((bankVals.kirim ?? 0) - totalExp(bankVals), false) : '—'}</td>
                <td className="td" />
                <td className="td text-right font-bold tnum">{taxVals.kirim !== null ? money((taxVals.kirim ?? 0) - totalExp(taxVals), false) : '—'}</td>
                <td className="td" />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 pt-4">
          {Object.values(bankVals).some((v) => v !== null) || Object.values(taxVals).some((v) => v !== null) ? (
            <div className={cn('mb-4 rounded-field px-3 py-2.5 text-[13px] font-semibold', issues ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good')}>
              {issues ? `${issues} ta katakda farq bor. Naqd pul bankka topshirilganini, hujjatsiz yechimlarni va oylik summalarini tekshiring.` : "Kiritilgan qatorlarda farq yo'q."}
            </div>
          ) : (
            <div className="mb-4 rounded-field bg-canvas px-3 py-2.5 text-[13px] font-semibold text-fg-muted">Bank ko&apos;chirmasi va soliq hisobotidagi raqamlarni kiriting.</div>
          )}
          <Field label="Izoh (farq sababi)">
            <textarea name="note" defaultValue={rec?.note ?? ''} rows={2} className="field" />
          </Field>
        </div>
      </ActionForm>
      <p className="px-5 pb-4 text-xs text-fg-muted">Soliq rejimi va hisobot muddatlarini bugalteringiz yoki soliq maslahatchisi bilan tasdiqlang.</p>
    </Card>
  );
}

function BarList({ items, empty }: { items: { label: string; value: number; color: string }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length) return <p className="px-5 pb-6 pt-2 text-sm text-fg-muted">{empty}</p>;
  return (
    <ul className="space-y-3 px-5 pb-5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
              {i.label}
            </span>
            <span className="tnum">
              <b>{money(i.value)}</b> <span className="text-fg-muted">{Math.round((i.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
