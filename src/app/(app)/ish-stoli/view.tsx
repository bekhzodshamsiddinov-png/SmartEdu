'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Circle, Phone, PhoneCall, Send, UserPlus, Wallet, CalendarClock, Loader2, Clock, BellRing, FileText } from 'lucide-react';
import { Badge, Button, Card, Field, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { useToast } from '@/components/toast';
import { setArrival, markCalled, logParentReport } from '@/app/actions/attendance';
import { logReminder } from '@/app/actions/payments';
import { saveLead } from '@/app/actions/leads';
import { submitReport, setTaskStatus } from '@/app/actions/tasks';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtShort, WEEKDAYS_FULL, weekday } from '@/lib/dates';

type Item = { key: string; label: string; done: number; total: number; href?: string; hint?: string };
type Lesson = { id: number; name: string; course: string; color: string; teacher: string | null; room: string | null; start_time: string; end_time: string; students: number; arrival: string | null; marked: number };
type Absent = { id: number; date: string; reason: string | null; student_id: number; name: string; phone: string | null; parent_phone: string | null; group_name: string; streak: boolean };
type Debtor = { id: number; name: string; parent_phone: string | null; phone: string | null; parent_name: string | null; debt: number; months: number; reminded: boolean };
type PG = { id: number; name: string; course: string; color: string; students: number; done: boolean };

export function DeskView({
  userName,
  date,
  items,
  score,
  lessons,
  absents,
  debtors,
  parentGroups,
  pays,
  tasks,
  reportDone,
  dueDay,
}: {
  userName: string;
  date: string;
  items: Item[];
  score: number | null;
  lessons: Lesson[];
  absents: Absent[];
  debtors: Debtor[];
  parentGroups: PG[];
  pays: { count: number; sum: number; cash: number };
  tasks: { id: number; title: string; dueDate: string | null; priority: string; status: string }[];
  reportDone: boolean;
  dueDay: number;
}) {
  const [call, setCall] = useState<Absent | null>(null);
  const [report, setReport] = useState<PG | null>(null);
  const done = items.filter((i) => i.total === 0 || i.done >= i.total).length;
  const pct = score ?? 100;
  const toRemind = debtors.filter((d) => !d.reminded);

  return (
    <div className="space-y-6">
      {/* Kun holati */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-5 lg:w-[340px] lg:shrink-0">
            <Ring value={pct} />
            <div>
              <p className="text-sm font-medium text-fg-muted">
                {WEEKDAYS_FULL[weekday(date)]}, {fmtDate(date)}
              </p>
              <h1 className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">
                {pct >= 100 ? `Barakalla, ${userName}` : `Bugungi ishlar, ${userName}`}
              </h1>
              <p className="mt-1 text-sm text-fg-muted">
                {done} / {items.length} bo&apos;lim yakunlangan
              </p>
            </div>
          </div>
          <ol className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((it) => {
              const ok = it.total === 0 || it.done >= it.total;
              return (
                <li key={it.key}>
                  <a href={it.href ?? '#'} className={cn('flex h-full items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors', ok ? 'border-transparent bg-good-soft/70' : 'border-line bg-white hover:border-line-strong')}>
                    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" />}
                    <span className="min-w-0">
                      <span className={cn('block text-[13px] font-semibold leading-snug', ok && 'text-good')}>{it.label}</span>
                      <span className="text-xs text-fg-muted tnum">{it.total === 0 ? 'Bugun kerak emas' : `${it.done} / ${it.total}`}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <div className="space-y-6">
          {/* Darslar */}
          <Card id="darslar" className="scroll-mt-24 overflow-hidden">
            <SectionHead title="Bugungi darslar" sub="O'qituvchi kelishini dars boshlanishida belgilang" right={<Link href="/davomat" className="text-[13px] font-bold text-brand hover:underline">Davomat</Link>} />
            {lessons.length === 0 ? (
              <p className="border-t border-line px-5 py-6 text-sm text-fg-muted">Bugun dars yo&apos;q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {lessons.map((l) => (
                  <LessonRow key={l.id} l={l} date={date} />
                ))}
              </ul>
            )}
          </Card>

          {/* Qo'ng'iroqlar */}
          <Card id="qongiroqlar" className="scroll-mt-24 overflow-hidden">
            <SectionHead title="Kelmaganlarga qo'ng'iroq" sub="Sababini aniqlab, natijasini yozing" count={absents.length} tone="bad" />
            {absents.length === 0 ? (
              <Done text="Hamma kelmaganlarga qo'ng'iroq qilingan." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {absents.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2.5 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/oquvchilar?id=${a.student_id}`} className="text-sm font-bold hover:text-brand">
                          {a.name}
                        </Link>
                        {a.streak && <Badge tone="warn">2 dars ketma-ket</Badge>}
                      </div>
                      <div className="text-xs text-fg-muted">
                        {a.group_name}, {a.date === date ? 'bugun' : fmtShort(a.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(a.parent_phone || a.phone) && (
                        <a href={`tel:+${a.parent_phone || a.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold tnum hover:bg-canvas">
                          <Phone className="h-3.5 w-3.5" /> {phone(a.parent_phone || a.phone)}
                        </a>
                      )}
                      <Button size="sm" onClick={() => setCall(a)}>
                        <PhoneCall className="h-3.5 w-3.5" /> Natija
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* To'lov eslatmalari */}
          <Card id="eslatmalar" className="scroll-mt-24 overflow-hidden">
            <SectionHead
              title="To'lov eslatmalari"
              sub={`Muddat: har oyning 1–${dueDay}-sanasi. Eslatma 7 kunda bir marta.`}
              count={toRemind.length}
              tone="bad"
              right={<Link href="/tolovlar?tab=qarzdorlar" className="text-[13px] font-bold text-brand hover:underline">Qarzdorlar</Link>}
            />
            {debtors.length === 0 ? (
              <Done text="Qarzdor o'quvchi yo'q." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {debtors.slice(0, 12).map((d) => (
                  <li key={d.id} className={cn('flex flex-col gap-2.5 px-5 py-3 sm:flex-row sm:items-center', d.reminded && 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <Link href={`/oquvchilar?id=${d.id}`} className="text-sm font-bold hover:text-brand">
                        {d.name}
                      </Link>
                      <div className="text-xs text-fg-muted">
                        <span className="font-semibold text-bad tnum">{money(d.debt)}</span>
                        {d.months > 1 && `, ${d.months} oylik`}
                        {d.parent_name && `, ${d.parent_name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(d.parent_phone || d.phone) && (
                        <a href={`tel:+${d.parent_phone || d.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold tnum hover:bg-canvas">
                          <Phone className="h-3.5 w-3.5" /> {phone(d.parent_phone || d.phone)}
                        </a>
                      )}
                      {d.reminded ? (
                        <Badge tone="good">Eslatildi</Badge>
                      ) : (
                        <ActionButton action={() => logReminder(d.id)} variant="soft">
                          <BellRing className="h-3.5 w-3.5" /> Eslatildi
                        </ActionButton>
                      )}
                    </div>
                  </li>
                ))}
                {debtors.length > 12 && (
                  <li className="px-5 py-3 text-center text-[13px]">
                    <Link href="/tolovlar?tab=qarzdorlar" className="font-bold text-brand">
                      Yana {debtors.length - 12} ta qarzdor
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Kassa */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">Bugungi kassa</h2>
              <Link href="/tolovlar?yangi=1" className="inline-flex h-8 items-center gap-1.5 rounded-field bg-brand px-3 text-[13px] font-bold text-white">
                <Wallet className="h-3.5 w-3.5" /> To&apos;lov
              </Link>
            </div>
            <div className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] tnum">{money(pays.sum)}</div>
            <div className="mt-1 text-[13px] text-fg-muted">
              {pays.count} ta to&apos;lov, naqd {money(pays.cash)}
            </div>
          </Card>

          {/* Ota-onaga hisobot */}
          <Card id="ota-ona" className="scroll-mt-24 overflow-hidden">
            <SectionHead title="Ota-onaga haftalik hisobot" sub="Har bir guruh uchun haftasiga kamida 1 marta" />
            <ul className="divide-y divide-line border-t border-line">
              {parentGroups.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="h-7 w-1 rounded-full" style={{ background: g.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{g.name}</div>
                    <div className="truncate text-xs text-fg-muted">
                      {g.course}, {g.students} o&apos;quvchi
                    </div>
                  </div>
                  {g.done ? (
                    <Badge tone="good">Yuborildi</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setReport(g)} disabled={!g.students}>
                      <Send className="h-3.5 w-3.5" /> Yuborish
                    </Button>
                  )}
                </li>
              ))}
              {parentGroups.length === 0 && <li className="px-5 py-4 text-sm text-fg-muted">Faol guruh yo&apos;q.</li>}
            </ul>
          </Card>

          {/* Ofisga kelgan odam */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <UserPlus className="h-4 w-4 text-brand" /> Ofisga kelgan odam
            </h2>
            <p className="mb-3 mt-0.5 text-[13px] text-fg-muted">Ma&apos;lumot so&apos;rab kelgan har bir kishini lid sifatida yozing.</p>
            <ActionForm action={saveLead.bind(null, null)} submitLabel="Lidga qo'shish" successText="Lid qo'shildi" resetOnSuccess>
              <input type="hidden" name="source" value="Ofisga keldi" />
              <div className="grid grid-cols-2 gap-3">
                <input name="fullName" className="field" placeholder="Ismi" required aria-label="Ismi" />
                <input name="phone" type="tel" className="field" placeholder="Telefon" required aria-label="Telefon" />
              </div>
              <input name="note" className="field" placeholder="Nimaga qiziqdi" aria-label="Izoh" />
            </ActionForm>
          </Card>

          {/* Vazifalar */}
          <Card className="overflow-hidden">
            <SectionHead title="Mening vazifalarim" right={<Link href="/vazifalar" className="text-[13px] font-bold text-brand hover:underline">Hammasi</Link>} />
            {tasks.length === 0 ? (
              <Done text="Ochiq vazifa yo'q." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {tasks.map((t) => (
                  <TaskRow key={t.id} t={t} today={date} />
                ))}
              </ul>
            )}
          </Card>

          {/* Kunlik hisobot */}
          <Card id="hisobot" className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <FileText className="h-4 w-4 text-brand" /> Kunlik hisobot
            </h2>
            {reportDone ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-good">
                <CheckCircle2 className="h-4 w-4" /> Bugungi hisobot yuborilgan
              </p>
            ) : (
              <div className="mt-3">
                <ActionForm action={submitReport} submitLabel="Hisobotni yuborish">
                  <input type="hidden" name="date" value={date} />
                  <textarea
                    name="done"
                    rows={4}
                    className="field"
                    required
                    aria-label="Bugun nima qilindi"
                    defaultValue={autoSummary(items, lessons, pays)}
                  />
                  <input name="problems" className="field" placeholder="Muammolar (agar bo'lsa)" aria-label="Muammolar" />
                </ActionForm>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={!!call} onClose={() => setCall(null)} title="Qo'ng'iroq natijasi" sub={call ? `${call.name}, ${call.group_name}` : undefined} size="sm">
        {call && <CallForm id={call.id} reason={call.reason} onDone={() => setCall(null)} />}
      </Modal>
      <Modal open={!!report} onClose={() => setReport(null)} title="Ota-onalarga hisobot" sub={report ? `${report.name}, ${report.students} ta ota-ona` : undefined} size="sm">
        {report && (
          <ActionForm action={async (fd) => logParentReport(report.id, String(fd.get('text') || ''))} onDone={() => setReport(null)} onCancel={() => setReport(null)} submitLabel="Yuborildi deb belgilash">
            <Field label="Nima yuborildi">
              <textarea name="text" rows={3} className="field" defaultValue="Haftalik proyekt va o'zlashtirish haqida ma'lumot yuborildi" />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}

function autoSummary(items: Item[], lessons: Lesson[], pays: { count: number; sum: number }) {
  const get = (k: string) => items.find((i) => i.key === k);
  const calls = get('calls');
  const rem = get('reminders');
  return [
    `${lessons.length} ta dars, davomat ${get('attendance')?.done ?? 0} tasida belgilandi.`,
    calls && calls.total ? `Kelmaganlardan ${calls.done}/${calls.total} tasiga qo'ng'iroq qilindi.` : null,
    `${pays.count} ta to'lov qabul qilindi (${money(pays.sum)}).`,
    rem && rem.total ? `${rem.done}/${rem.total} qarzdorga eslatma berildi.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function LessonRow({ l, date }: { l: Lesson; date: string }) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(l.arrival);
  const router = useRouter();
  const toast = useToast();
  const set = (s: 'vaqtida' | 'kechikdi' | 'otilmadi') => {
    setLocal(s);
    start(async () => {
      const r = await setArrival(l.id, date, s);
      if (r.ok) router.refresh();
      else {
        toast(r.error, 'err');
        setLocal(l.arrival);
      }
    });
  };
  const opts = [
    { k: 'vaqtida' as const, t: 'Keldi', on: 'border-good bg-good text-white' },
    { k: 'kechikdi' as const, t: 'Kechikdi', on: 'border-warn bg-warn text-white' },
    { k: 'otilmadi' as const, t: "O'tilmadi", on: 'border-bad bg-bad text-white' },
  ];
  return (
    <li className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: l.color }} />
        <div className="w-[74px] shrink-0 text-[15px] font-extrabold tnum">
          {l.start_time}
          <span className="block text-xs font-semibold text-fg-faint">{l.end_time}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">
            {l.name} <span className="font-medium text-fg-muted">{l.course}</span>
          </div>
          <div className="truncate text-xs text-fg-muted">
            {l.teacher ?? "O'qituvchi yo'q"}
            {l.room && `, ${l.room}-xona`}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-4 md:pl-0">
        <div className="flex gap-1">
          {opts.map((o) => (
            <button
              key={o.k}
              onClick={() => set(o.k)}
              disabled={pending}
              aria-pressed={local === o.k}
              className={cn('h-8 rounded-field border px-2.5 text-xs font-bold transition-colors', local === o.k ? o.on : 'border-line-strong bg-white text-fg-muted hover:text-fg')}
            >
              {o.t}
            </button>
          ))}
        </div>
        <Link
          href={`/davomat?guruh=${l.id}&sana=${date}`}
          className={cn('inline-flex h-8 min-w-[112px] items-center justify-center gap-1.5 rounded-field px-2.5 text-xs font-bold', l.marked ? 'bg-good-soft text-good' : 'bg-brand text-white')}
        >
          {l.marked ? (
            <>
              <Check className="h-3.5 w-3.5" /> Davomat {l.marked}
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5" /> Davomat
            </>
          )}
        </Link>
      </div>
    </li>
  );
}

function TaskRow({ t, today }: { t: { id: number; title: string; dueDate: string | null; priority: string }; today: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const late = t.dueDate && t.dueDate < today;
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <button
        onClick={() => start(async () => { await setTaskStatus(t.id, 'bajarildi'); router.refresh(); })}
        disabled={pending}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-line-strong hover:border-brand"
        aria-label="Bajarildi deb belgilash"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      <span className="min-w-0 flex-1 text-sm font-semibold">{t.title}</span>
      {t.dueDate && (
        <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', late ? 'font-bold text-bad' : 'text-fg-muted')}>
          <CalendarClock className="h-3 w-3" /> {fmtShort(t.dueDate)}
        </span>
      )}
    </li>
  );
}

function CallForm({ id, reason, onDone }: { id: number; reason: string | null; onDone: () => void }) {
  const [r, setR] = useState(reason ?? '');
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const quick = ['Kasal', 'Oilaviy sabab', 'Maktabda tadbir', 'Unutib qoldi', "Qiziqishi yo'qolgan", 'Moliyaviy sabab', "Telefon ko'tarmadi"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setR(q)} className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', r === q ? 'border-ink bg-ink text-white' : 'border-line-strong text-fg-muted')}>
            {q}
          </button>
        ))}
      </div>
      <textarea value={r} onChange={(e) => setR(e.target.value)} rows={3} className="field" placeholder="Nima deyishdi, qachon keladi" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Bekor qilish
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await markCalled(id, r);
              if (res.ok) {
                toast(res.message || 'Saqlandi');
                router.refresh();
                onDone();
              } else toast(res.error, 'err');
            })
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
        </Button>
      </div>
    </div>
  );
}

function SectionHead({ title, sub, count, tone, right }: { title: string; sub?: string; count?: number; tone?: 'bad'; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          {title}
          {count !== undefined && count > 0 && <span className={cn('rounded-full px-2 text-xs tnum', tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-canvas text-fg-muted')}>{count}</span>}
        </h2>
        {sub && <p className="mt-0.5 text-[13px] text-fg-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Done({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 border-t border-line px-5 py-4 text-sm font-semibold text-good">
      <CheckCircle2 className="h-4 w-4" /> {text}
    </p>
  );
}

function Ring({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 100 ? '#1E8A4C' : v >= 60 ? '#0E7C6B' : '#B8681A';
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#E9EEEC" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[17px] font-extrabold tnum">{v}%</span>
    </div>
  );
}
