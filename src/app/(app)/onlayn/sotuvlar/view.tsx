'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, ShoppingBag, Check, Undo2, X, Download, Loader2, TicketPercent } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { OnlineTabsClient } from '@/components/online/tabs-client';
import { createOrder, quotePrice, setOrderStatus } from '@/app/actions/online';
import { ORDER_METHODS, ORDER_STATUS, LEAD_SOURCES } from '@/lib/constants';
import { money, phone } from '@/lib/format';
import { addMonths, fmtMonth, fmtShort, thisMonth, today } from '@/lib/dates';

type O = { id: number; learner_id: number; name: string; phone: string; course_id: number; course: string; color: string; amount: number; original_price: number; promo_code: string | null; method: string; status: string; paid_at: string | null; access_until: string | null; created: string; note: string | null; by: string | null };

export function SalesView({ month, holat, orders, courses, learners, openNew, presetCourse, isBoss }: { month: string; holat: string; orders: O[]; courses: { id: number; title: string; price: number; status: string }[]; learners: { id: number; name: string; phone: string }[]; openNew: boolean; presetCourse: number | null; isBoss: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(openNew);
  const [course, setCourse] = useState('');
  useEffect(() => setOpen(openNew), [openNew]);
  const close = () => (openNew ? router.push(path) : setOpen(false));
  const list = orders.filter((o) => !course || String(o.course_id) === course);
  const paid = list.filter((o) => o.status === 'tolandi');
  const revenue = paid.reduce((s, o) => s + o.amount, 0);
  const discount = paid.reduce((s, o) => s + (o.original_price - o.amount), 0);
  const pending = list.filter((o) => o.status === 'kutilmoqda');

  const exportCsv = () => {
    const rows = [['Sana', "O'quvchi", 'Telefon', 'Kurs', 'Summa', 'Promokod', 'Usul', 'Holat', "To'langan"], ...list.map((o) => [o.created, o.name, o.phone, o.course, o.amount, o.promo_code ?? '', ORDER_METHODS[o.method] ?? o.method, ORDER_STATUS[o.status]?.label ?? o.status, o.paid_at ?? ''])];
    const csv = rows.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `onlayn-sotuvlar-${month}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader
        title="Sotuvlar"
        sub={holat === 'kutilmoqda' ? "To'lovni kutayotgan barcha buyurtmalar" : `${fmtMonth(month)} buyurtmalari`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Sotuv qo&apos;shish
            </Button>
          </>
        }
      />
      <OnlineTabsClient active="/onlayn/sotuvlar" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tushum" value={money(revenue, false)} hint={`${paid.length} ta to'lov, so'm`} />
        <Stat label="O'rtacha chek" value={paid.length ? money(revenue / paid.length, false) : '—'} hint="so'm" />
        <Stat label="Chegirmalar" value={money(discount, false)} hint="promokodlar orqali" />
        <Stat label="To'lov kutilmoqda" value={String(pending.length)} tone={pending.length ? 'warn' : 'neutral'} hint={money(pending.reduce((s, o) => s + o.amount, 0))} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`${path}?oy=${month}`} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-bold', holat !== 'kutilmoqda' ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted')}>
            Oy bo&apos;yicha
          </Link>
          <Link href={`${path}?holat=kutilmoqda`} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-bold', holat === 'kutilmoqda' ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted')}>
            To&apos;lov kutilmoqda
          </Link>
          <select value={course} onChange={(e) => setCourse(e.target.value)} className="field h-9 w-56" aria-label="Kurs">
            <option value="">Barcha kurslar</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        {holat !== 'kutilmoqda' && (
          <div className="card flex items-center self-start">
            <Button size="icon" variant="ghost" onClick={() => router.push(`${path}?oy=${addMonths(month, -1)}`)} aria-label="Oldingi oy">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-[13px] font-bold">{fmtMonth(month)}</span>
            <Button size="icon" variant="ghost" onClick={() => router.push(`${path}?oy=${addMonths(month, 1)}`)} disabled={month >= thisMonth()} aria-label="Keyingi oy">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty icon={<ShoppingBag className="h-5 w-5" />} title="Buyurtma yo'q" text="Click, Payme yoki naqd orqali sotilgan har bir kursni shu yerga kiriting. O'quvchi avtomatik yaratiladi." action={<Button onClick={() => setOpen(true)}>Sotuv qo&apos;shish</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className="th">Sana</th>
                  <th className="th">O&apos;quvchi</th>
                  <th className="th">Kurs</th>
                  <th className="th">Usul</th>
                  <th className="th">Holat</th>
                  <th className="th text-right">Summa</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-canvas/60">
                    <td className="td text-fg-muted">{fmtShort(o.created)}</td>
                    <td className="td">
                      <Link href={`/onlayn/oquvchilar?id=${o.learner_id}`} className="font-bold hover:text-brand">
                        {o.name}
                      </Link>
                      <div className="text-xs text-fg-muted tnum">{phone(o.phone)}</div>
                    </td>
                    <td className="td">
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: o.color }} />
                        {o.course}
                      </span>
                      {o.access_until && o.status === 'tolandi' && <div className="pl-[18px] text-xs text-fg-muted">kirish {fmtShort(o.access_until)} gacha</div>}
                    </td>
                    <td className="td text-[13px]">{ORDER_METHODS[o.method] ?? o.method}</td>
                    <td className="td">
                      <Badge tone={ORDER_STATUS[o.status]?.tone ?? 'neutral'}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                    </td>
                    <td className="td text-right">
                      <div className="font-bold tnum">{money(o.amount)}</div>
                      {o.promo_code && (
                        <div className="inline-flex items-center gap-1 text-xs text-info">
                          <TicketPercent className="h-3 w-3" /> {o.promo_code}
                        </div>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-right">
                      {o.status === 'kutilmoqda' && (
                        <>
                          <ActionButton variant="soft" action={() => setOrderStatus(o.id, 'tolandi')}>
                            <Check className="h-3.5 w-3.5" /> To&apos;landi
                          </ActionButton>
                          <ActionButton variant="ghost" size="icon" action={() => setOrderStatus(o.id, 'bekor')} confirm="Buyurtma bekor qilinsinmi?" title="Bekor qilish">
                            <X className="h-4 w-4" />
                          </ActionButton>
                        </>
                      )}
                      {o.status === 'tolandi' && isBoss && (
                        <ActionButton variant="ghost" action={() => setOrderStatus(o.id, 'qaytarildi')} confirm="Pul qaytarildimi? Kursga kirish yopiladi." title="Pulni qaytarish">
                          <Undo2 className="h-3.5 w-3.5" /> Qaytarish
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={open} onClose={close} title="Yangi sotuv" sub="Agar o'quvchi bazada bo'lmasa, avtomatik qo'shiladi">
        <OrderForm courses={courses.filter((c) => c.status !== 'yopiq')} learners={learners} preset={presetCourse} onDone={close} />
      </Modal>
    </>
  );
}

function OrderForm({ courses, learners, preset, onDone }: { courses: { id: number; title: string; price: number }[]; learners: { id: number; name: string; phone: string }[]; preset: number | null; onDone: () => void }) {
  const [courseId, setCourseId] = useState<number | null>(preset ?? courses[0]?.id ?? null);
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<{ price: number; discount: number; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const [ph, setPh] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('tolandi');
  const course = courses.find((c) => c.id === courseId);
  const digits = ph.replace(/\D/g, '');
  const match = useMemo(() => (digits.length >= 4 ? learners.filter((l) => l.phone.includes(digits)).slice(0, 4) : []), [digits, learners]);

  useEffect(() => setQuote(null), [courseId]);
  const apply = () =>
    courseId &&
    start(async () => {
      const r = await quotePrice(courseId, code);
      setQuote(r.ok ? { price: r.price, discount: r.discount } : { price: course?.price ?? 0, discount: 0, error: r.error });
    });
  const price = quote && !quote.error ? quote.price : course?.price ?? 0;

  return (
    <ActionForm action={createOrder} onDone={onDone} onCancel={onDone} submitLabel={status === 'tolandi' ? 'Sotuvni saqlash' : "Buyurtmani qo'shish"}>
      <Field label="Kurs">
        <select name="courseId" value={courseId ?? ''} onChange={(e) => setCourseId(Number(e.target.value))} className="field" required>
          {courses.length === 0 && <option value="">Avval kurs yarating</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({money(c.price)})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <input name="phone" type="tel" value={ph} onChange={(e) => setPh(e.target.value)} className="field" placeholder="90 123 45 67" required />
        </Field>
        <Field label="Ism-familiya">
          <input name="fullName" value={name} onChange={(e) => setName(e.target.value)} className="field" required />
        </Field>
      </div>
      {match.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {match.map((l) => (
            <button type="button" key={l.id} onClick={() => { setPh(l.phone.slice(3)); setName(l.name); }} className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-semibold hover:border-brand">
              {l.name}, {phone(l.phone)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Promokod">
          <div className="flex gap-2">
            <input name="promoCode" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} className="field uppercase" placeholder="Ixtiyoriy" />
            <Button variant="secondary" onClick={apply} disabled={!code || pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qo'llash"}
            </Button>
          </div>
          {quote?.error && <span className="mt-1 block text-xs font-semibold text-bad">{quote.error}</span>}
          {quote && !quote.error && <span className="mt-1 block text-xs font-semibold text-good">Chegirma {money(quote.discount)}</span>}
        </Field>
        <Field label="Summa" hint={course ? `Narx: ${money(course.price)}` : undefined}>
          <MoneyInput key={`${courseId}-${price}`} name="amount" defaultValue={price} />
        </Field>
      </div>
      <Field label="To'lov usuli">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(ORDER_METHODS).map(([k, v], i) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="method" value={k} defaultChecked={i === 0} className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-field border border-line-strong px-1 text-center text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong">{v.replace(" o'tkazmasi", '')}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Holat">
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field">
            <option value="tolandi">To&apos;landi</option>
            <option value="kutilmoqda">To&apos;lov kutilmoqda</option>
          </select>
        </Field>
        {status === 'tolandi' && (
          <Field label="To'lov sanasi">
            <input type="date" name="paidAt" defaultValue={today()} className="field" />
          </Field>
        )}
        <Field label="Qayerdan keldi">
          <select name="source" className="field" defaultValue="Instagram">
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Izoh">
        <input name="note" className="field" placeholder="Masalan: chek raqami" />
      </Field>
    </ActionForm>
  );
}
