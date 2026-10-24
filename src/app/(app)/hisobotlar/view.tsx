'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Printer, FileText } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, Stat, cn } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { submitReport } from '@/app/actions/tasks';
import { ROLE_LABELS } from '@/lib/roles';
import { money, pct } from '@/lib/format';
import { addMonths, fmtDate, fmtMonth, thisMonth, today } from '@/lib/dates';
import type { Role } from '@/db/schema';

type Monthly = {
  flow: { active: number; joined: number; left: number; grad: number; frozen: number };
  att: { total: number; present: number; rate: number };
  fun: { total: number; contacted: number; trial: number; came: number; paid: number; lost: number };
  reasons: { reason: string; c: number; returned: number }[];
  ie: { tuition: number; otherIncome: number; income: number; expense: number; profit: number } | null;
  rev: { name: string; color: string; s: number }[];
  exp: { category: string; s: number }[];
  byCourse: { name: string; color: string; active: number; joined: number; left: number }[];
  bySource: { source: string; total: number; paid: number }[];
  byGroup: { name: string; teacher: string | null; total: number; present: number; lessons: number; late: number; missed: number }[];
  results: { type: string; c: number }[];
  branches: { id: number; name: string; active: number; joined: number; left: number; tuition: number; other: number; expense: number; groups: number }[];
  branchName: string | null;
};
type Rep = { id: number; date: string; kind: string; done: string; problems: string | null; plan: string | null; user: string; role: Role; userId: number };

export function ReportsView({ month, tab, showMonthly, monthly, reports, isBoss }: { month: string; tab: 'oylik' | 'xodim'; showMonthly: boolean; monthly: Monthly | null; reports: Rep[]; isBoss: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const m = monthly;
  return (
    <>
      <PageHeader
        title="Hisobotlar"
        sub={tab === 'oylik' ? `${fmtMonth(month)} bo'yicha ${m?.branchName ? `${m.branchName} hisoboti` : 'umumiy hisobot'}` : 'Kunlik va haftalik hisobotlar'}
        actions={
          tab === 'oylik' && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Chop etish / PDF
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        {showMonthly ? (
          <div className="inline-flex rounded-field border border-line bg-white p-1">
            <Link href={`${path}?oy=${month}`} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'oylik' ? 'bg-ink text-white' : 'text-fg-muted')}>
              Oylik hisobot
            </Link>
            <Link href={`${path}?tab=xodim`} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'xodim' ? 'bg-ink text-white' : 'text-fg-muted')}>
              Xodimlar hisobotlari
            </Link>
          </div>
        ) : (
          <span />
        )}
        {tab === 'oylik' && (
          <div className="card flex items-center self-start">
            <Button size="icon" variant="ghost" onClick={() => router.push(`${path}?oy=${addMonths(month, -1)}`)} aria-label="Oldingi oy">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-[13px] font-bold">{fmtMonth(month)}</span>
            <Button size="icon" variant="ghost" onClick={() => router.push(`${path}?oy=${addMonths(month, 1)}`)} disabled={month >= thisMonth()} aria-label="Keyingi oy">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {tab === 'oylik' && m && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Faol o'quvchilar" value={String(m.flow.active)} />
            <Stat label="Qo'shildi" value={String(m.flow.joined)} tone="good" />
            <Stat label="Ketdi" value={String(m.flow.left)} tone={m.flow.left ? 'bad' : 'neutral'} hint={m.reasons.reduce((a, r) => a + r.returned, 0) ? `${m.reasons.reduce((a, r) => a + r.returned, 0)} tasi qaytarildi` : undefined} />
            <Stat label="Bitirdi" value={String(m.flow.grad)} />
            {m.ie && (
              <>
                <Stat label="Kirim" value={money(m.ie.income, false)} hint="so'm" />
                <Stat label="Xarajat" value={money(m.ie.expense, false)} hint="so'm" />
                <Stat label="Sof foyda" value={money(m.ie.profit, false)} tone={m.ie.profit >= 0 ? 'good' : 'bad'} hint="so'm" />
              </>
            )}
            <Stat label="O'rtacha davomat" value={pct(m.att.rate)} tone={m.att.rate < 80 ? 'warn' : 'neutral'} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Yo'nalishlar bo'yicha" />
              <Tbl head={["Yo'nalish", 'Faol', "Qo'shildi", 'Ketdi']} rows={m.byCourse.map((c) => [<Dot key="d" color={c.color} label={c.name} />, c.active, c.joined, c.left])} />
            </Card>
            <Card>
              <CardHeader title="Ketish sabablari" sub="Nechtasi qaytarildi" />
              {m.reasons.length ? <Tbl head={['Sabab', 'Ketdi', 'Qaytdi']} rows={m.reasons.map((r) => [r.reason, r.c, r.returned])} /> : <p className="px-5 pb-5 text-sm text-fg-muted">Bu oyda hech kim ketmagan.</p>}
            </Card>
            {m.ie && (
              <>
                <Card>
                  <CardHeader title="Kirim yo'nalishlar bo'yicha" />
                  {m.rev.length ? <Tbl head={["Yo'nalish", 'Summa', 'Ulush']} rows={m.rev.map((r) => [<Dot key="d" color={r.color} label={r.name} />, money(r.s), pct((r.s / Math.max(1, m.ie!.tuition)) * 100)])} /> : <p className="px-5 pb-5 text-sm text-fg-muted">To&apos;lov yo&apos;q.</p>}
                </Card>
                <Card>
                  <CardHeader title="Xarajatlar" />
                  {m.exp.length ? <Tbl head={['Toifa', 'Summa', 'Ulush']} rows={m.exp.map((r) => [r.category, money(r.s), pct((r.s / Math.max(1, m.ie!.expense)) * 100)])} /> : <p className="px-5 pb-5 text-sm text-fg-muted">Xarajat kiritilmagan.</p>}
                </Card>
              </>
            )}
            <Card>
              <CardHeader title="Lidlar manbalar bo'yicha" sub={`Jami ${m.fun.total}, to'lov qildi ${m.fun.paid}`} />
              {m.bySource.length ? <Tbl head={['Manba', 'Lidlar', "To'lov qildi", 'Konversiya']} rows={m.bySource.map((s) => [s.source, s.total, s.paid, pct((s.paid / Math.max(1, s.total)) * 100)])} /> : <p className="px-5 pb-5 text-sm text-fg-muted">Lid yo&apos;q.</p>}
            </Card>
            <Card>
              <CardHeader title="O'quvchilar natijalari" />
              {m.results.length ? <Tbl head={['Turi', 'Soni']} rows={m.results.map((r) => [r.type, r.c])} /> : <p className="px-5 pb-5 text-sm text-fg-muted">Bu oyda natija yozilmagan.</p>}
            </Card>
          </div>
          {m.branches.length > 0 && (
            <Card>
              <CardHeader title="Filiallar taqqoslamasi" sub={fmtMonth(month)} />
              <Tbl
                head={['Filial', 'Guruhlar', 'Faol', "Qo'shildi", 'Ketdi', 'Kirim', 'Xarajat', 'Foyda']}
                rows={m.branches.map((b) => {
                  const inc = b.tuition + b.other;
                  return [b.name, b.groups, b.active, b.joined, b.left, money(inc), money(b.expense), <span key="p" className={inc - b.expense < 0 ? 'font-bold text-bad' : 'font-bold text-good'}>{money(inc - b.expense)}</span>];
                })}
              />
              <p className="px-5 py-3 text-xs text-fg-muted">Onlayn kurslar tushumi filiallarga taqsimlanmaydi va bu jadvalga kirmaydi.</p>
            </Card>
          )}
          <Card>
            <CardHeader title="Guruhlar va o'qituvchilar" sub="Davomat va o'tilgan darslar" />
            <Tbl
              head={['Guruh', "O'qituvchi", 'Darslar', 'Kechikdi', "O'tilmadi", 'Davomat']}
              rows={m.byGroup.map((g) => [g.name, g.teacher ?? '—', g.lessons, g.late, g.missed, g.total ? pct((g.present / g.total) * 100) : '—'])}
            />
          </Card>
        </div>
      )}

      {tab === 'xodim' && (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5 print:hidden">
            <h2 className="mb-1 text-[15px] font-bold">Hisobot yozish</h2>
            <p className="mb-4 text-[13px] text-fg-muted">Har kuni 18:00 da: nima qilindi, qanday muammo bor, ertaga nima qilinadi.</p>
            <ActionForm action={submitReport} submitLabel="Hisobotni yuborish" resetOnSuccess>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sana">
                  <input type="date" name="date" defaultValue={today()} className="field" />
                </Field>
                <Field label="Turi">
                  <select name="kind" className="field">
                    <option value="kunlik">Kunlik</option>
                    <option value="haftalik">Haftalik</option>
                  </select>
                </Field>
              </div>
              <Field label="Bugun nima qilindi">
                <textarea name="done" rows={4} className="field" placeholder="Masalan: 4 ta dars o'tdi, 3 ta kelmaganga qo'ng'iroq qilindi, 2 ta to'lov qabul qilindi" required />
              </Field>
              <Field label="Muammolar">
                <textarea name="problems" rows={2} className="field" />
              </Field>
              <Field label="Ertangi reja">
                <textarea name="plan" rows={2} className="field" />
              </Field>
            </ActionForm>
          </Card>
          <div>
            {reports.length === 0 ? (
              <Card>
                <Empty icon={<FileText className="h-5 w-5" />} title="Hali hisobot yo'q" text={isBoss ? 'Xodimlar yozgan hisobotlar shu yerda ko\'rinadi.' : 'Birinchi hisobotingizni yozing.'} />
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{r.user}</span>
                        <span className="text-xs text-fg-muted">{ROLE_LABELS[r.role]}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <Badge tone={r.kind === 'haftalik' ? 'brand' : 'neutral'}>{r.kind === 'haftalik' ? 'Haftalik' : 'Kunlik'}</Badge>
                        {fmtDate(r.date)}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{r.done}</p>
                    {r.problems && (
                      <p className="mt-2 whitespace-pre-wrap rounded-field bg-warn-soft px-3 py-2 text-[13px] text-warn">
                        <b>Muammo:</b> {r.problems}
                      </p>
                    )}
                    {r.plan && (
                      <p className="mt-2 whitespace-pre-wrap text-[13px] text-fg-muted">
                        <b className="text-fg">Reja:</b> {r.plan}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Tbl({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full">
        <thead className="bg-canvas/60">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn('th', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cn('td', j > 0 && 'text-right tnum')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
