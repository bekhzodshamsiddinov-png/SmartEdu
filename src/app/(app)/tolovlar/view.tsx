'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Wallet, Plus, Phone, BellRing, ChevronLeft, ChevronRight, Download, Receipt } from 'lucide-react';
import { Badge, Button, Card, Empty, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-form';
import { PaymentForm, type StudentOpt } from '@/components/forms';
import { logReminder } from '@/app/actions/payments';
import { CancelPaymentButton } from '@/components/cancel-payment';
import { PAY_METHOD_LABEL, PAY_METHODS } from '@/lib/constants';
import { money, phone } from '@/lib/format';
import { addMonths, fmtDate, fmtMonth, fmtShort, thisMonth, today } from '@/lib/dates';

type Pay = { id: number; amount: number; method: string; paidAt: string; forMonth: string | null; note: string | null; studentId: number; student: string; by: string | null; cancelled: boolean; cancelReason: string | null };
type Debtor = { id: number; name: string; phone: string | null; parentName: string | null; debt: number; months: number; fee: number; lastPaid: string | null };

export function PaymentsView({ month, list, students, debtors, dueDay, tab, openNew, isBoss }: { month: string; list: Pay[]; students: StudentOpt[]; debtors: Debtor[]; dueDay: number; tab: 'tolovlar' | 'qarzdorlar'; openNew: boolean; isBoss: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState<StudentOpt | true | null>(openNew ? true : null);
  const [method, setMethod] = useState('');
  useEffect(() => setOpen(openNew ? true : null), [openNew]);
  const shown = list.filter((p) => !method || p.method === method);
  const live = list.filter((p) => !p.cancelled);
  const total = live.reduce((s, p) => s + p.amount, 0);
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of live) m[p.method] = (m[p.method] ?? 0) + p.amount;
    return m;
  }, [live]);
  const debtSum = debtors.reduce((s, d) => s + d.debt, 0);
  const cash = byMethod.naqd ?? 0;
  const go = (q: string) => router.push(`${path}?${q}`, { scroll: false });
  const close = () => (openNew ? router.push(path) : setOpen(null));

  const exportCsv = () => {
    const rows = tab === 'tolovlar' ? [['Sana', "O'quvchi", 'Summa', 'Usul', 'Oy', 'Qabul qildi', 'Izoh'], ...shown.map((p) => [p.paidAt, p.student, p.amount, PAY_METHOD_LABEL[p.method], p.forMonth ?? '', p.by ?? '', p.note ?? ''])] : [["O'quvchi", 'Telefon', 'Qarz', 'Oylar', "Oxirgi to'lov"], ...debtors.map((d) => [d.name, d.phone ?? '', d.debt, d.months, d.lastPaid ?? ''])];
    const csv = rows.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${tab}-${month}.csv`;
    a.click();
  };

  const isLate = Number(today().slice(8)) > dueDay;

  return (
    <>
      <PageHeader
        title="To'lovlar"
        sub={`To'lov muddati: har oyning 1–${dueDay}-sanasi`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> To&apos;lov qabul qilish
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Tushum, ${fmtMonth(month).toLowerCase()}`} value={money(total, false)} hint={`${live.length} ta to'lov, so'm`} />
        <Stat label="Onlayn va karta" value={money(total - cash, false)} hint={total ? `${Math.round(((total - cash) / total) * 100)}% naqdsiz` : 'so\'m'} />
        <Stat label="Naqd" value={money(cash, false)} hint="Kassaga topshirilishi kerak" />
        <Stat label="Umumiy qarzdorlik" value={money(debtSum, false)} tone={debtSum ? 'bad' : 'neutral'} hint={`${debtors.length} ta o'quvchi`} href={`${path}?tab=qarzdorlar`} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-field border border-line bg-white p-1">
          <Link href={`${path}?oy=${month}`} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'tolovlar' ? 'bg-ink text-white' : 'text-fg-muted')}>
            To&apos;lovlar
          </Link>
          <Link href={`${path}?tab=qarzdorlar`} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'qarzdorlar' ? 'bg-ink text-white' : 'text-fg-muted')}>
            Qarzdorlar <span className={cn('rounded-full px-1.5 text-xs tnum', tab === 'qarzdorlar' ? 'bg-white/20' : 'bg-bad-soft text-bad')}>{debtors.length}</span>
          </Link>
        </div>
        {tab === 'tolovlar' && (
          <div className="flex items-center gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="field h-9 w-40" aria-label="To'lov usuli">
              <option value="">Barcha usullar</option>
              {PAY_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="card flex items-center">
              <Button size="icon" variant="ghost" onClick={() => go(`oy=${addMonths(month, -1)}`)} aria-label="Oldingi oy">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center text-[13px] font-bold">{fmtMonth(month)}</span>
              <Button size="icon" variant="ghost" onClick={() => go(`oy=${addMonths(month, 1)}`)} disabled={month >= thisMonth()} aria-label="Keyingi oy">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {tab === 'tolovlar' ? (
        <Card>
          {shown.length === 0 ? (
            <Empty icon={<Wallet className="h-5 w-5" />} title="Bu oyda to'lov yo'q" text="Har bir to'lovni o'sha kuni kiriting: naqd ham, karta ham." action={<Button onClick={() => setOpen(true)}>To&apos;lov qabul qilish</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-line bg-canvas/60">
                  <tr>
                    <th className="th">Sana</th>
                    <th className="th">O&apos;quvchi</th>
                    <th className="th">Usul</th>
                    <th className="th">Qaysi oy</th>
                    <th className="th">Qabul qildi</th>
                    <th className="th text-right">Summa</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((p) => (
                    <tr key={p.id} className={cn('hover:bg-canvas/60', p.cancelled && 'opacity-55')}>
                      <td className="td text-fg-muted">{fmtShort(p.paidAt)}</td>
                      <td className="td">
                        <Link href={`/oquvchilar?id=${p.studentId}`} className="font-bold hover:text-brand">
                          {p.student}
                        </Link>
                        {p.note && <div className="text-xs text-fg-muted">{p.note}</div>}
                        {p.cancelled && <div className="text-xs font-semibold text-bad">Bekor qilingan{p.cancelReason ? `: ${p.cancelReason}` : ''}</div>}
                      </td>
                      <td className="td">
                        <Badge tone={p.method === 'naqd' ? 'warn' : 'info'}>{PAY_METHOD_LABEL[p.method]}</Badge>
                      </td>
                      <td className="td text-fg-muted">{p.forMonth ? fmtMonth(p.forMonth) : '—'}</td>
                      <td className="td text-fg-muted">{p.by ?? '—'}</td>
                      <td className={cn('td text-right font-bold tnum', p.cancelled && 'line-through')}>{money(p.amount)}</td>
                      <td className="td text-right">
                        <div className="flex justify-end">
                          {!p.cancelled && (
                            <a href={`/chek/${p.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-fg-muted hover:bg-canvas hover:text-fg" title="Chek" aria-label="Chek chiqarish">
                              <Receipt className="h-4 w-4" />
                            </a>
                          )}
                          {isBoss && !p.cancelled && <CancelPaymentButton id={p.id} amount={p.amount} who={p.student} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-canvas/60">
                  <tr>
                    <td className="td font-bold" colSpan={5}>
                      Jami
                    </td>
                    <td className="td text-right font-extrabold tnum">{money(shown.filter((p) => !p.cancelled).reduce((s, p) => s + p.amount, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          {isLate && debtors.length > 0 && (
            <div className="border-b border-line bg-bad-soft/60 px-5 py-3 text-[13px] text-bad">
              To&apos;lov muddati ({dueDay}-sana) o&apos;tdi. 10-sanagacha to&apos;lamaganlarning ota-onasi bilan uchrashing.
            </div>
          )}
          {debtors.length === 0 ? (
            <Empty icon={<Wallet className="h-5 w-5" />} title="Qarzdor yo'q" text="Barcha faol o'quvchilar to'lovni o'z vaqtida qilgan." />
          ) : (
            <ul className="divide-y divide-line">
              {debtors.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/oquvchilar?id=${d.id}`} className="text-sm font-bold hover:text-brand">
                      {d.name}
                    </Link>
                    <div className="text-xs text-fg-muted">
                      {d.parentName ? `${d.parentName}, ` : ''}oxirgi to&apos;lov: {d.lastPaid ? fmtDate(d.lastPaid) : "hech qachon"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-2 text-right">
                      <div className="text-[15px] font-extrabold text-bad tnum">{money(d.debt)}</div>
                      <div className="text-xs text-fg-muted">{d.months > 0 ? `${d.months} oylik` : ''}</div>
                    </div>
                    {d.phone && (
                      <a href={`tel:+${d.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold tnum hover:bg-canvas">
                        <Phone className="h-3.5 w-3.5" /> {phone(d.phone)}
                      </a>
                    )}
                    <ActionButton action={() => logReminder(d.id)} title="Eslatma berildi deb belgilash">
                      <BellRing className="h-3.5 w-3.5" /> Eslatildi
                    </ActionButton>
                    <Button size="sm" onClick={() => setOpen(students.find((s) => s.id === d.id) ?? true)}>
                      To&apos;lov
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!open} onClose={close} title="To'lov qabul qilish">
        {open && <PaymentForm students={students} fixedStudent={open === true ? undefined : open} onDone={close} onCancel={close} />}
      </Modal>
    </>
  );
}
