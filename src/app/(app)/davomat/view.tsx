'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCheck, ChevronLeft, ChevronRight, Loader2, Phone, PhoneCall, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { Avatar, Badge, Button, Card, Empty, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { useToast } from '@/components/toast';
import { saveAttendance, markCalled } from '@/app/actions/attendance';
import { addDays, fmtDate, WEEKDAYS_FULL, weekday } from '@/lib/dates';
import { phone } from '@/lib/format';

type St = 'keldi' | 'kechikdi' | 'kelmadi' | 'sababli';
const OPTS: { k: St; l: string; on: string }[] = [
  { k: 'keldi', l: 'Keldi', on: 'bg-good text-white border-good' },
  { k: 'kechikdi', l: 'Kechikdi', on: 'bg-warn text-white border-warn' },
  { k: 'kelmadi', l: 'Kelmadi', on: 'bg-bad text-white border-bad' },
  { k: 'sababli', l: 'Sababli', on: 'bg-info text-white border-info' },
];

type GroupItem = { id: number; name: string; course: string; color: string; start: string; end: string; teacher: string | null; today: boolean };

export function AttendanceView({
  reasonOpts,
  billing,
  groups,
  markedIds,
  group,
  date,
  todayStr,
  members,
  marks,
  lesson,
  absents,
  canSetTeacher,
  tab,
}: {
  groups: GroupItem[];
  markedIds: number[];
  group: GroupItem | null;
  date: string;
  todayStr: string;
  members: { id: number; name: string; status: string }[];
  marks: { studentId: number; status: string; reason: string | null; reasonId: number | null }[];
  reasonOpts: { id: number; title: string; charges: boolean }[];
  billing: string;
  lesson: { topic: string | null; teacherStatus: string } | null;
  absents: { id: number; date: string; reason: string | null; called: boolean; studentId: number; name: string; phone: string | null; parentPhone: string | null; group: string }[];
  canSetTeacher: boolean;
  tab: 'belgilash' | 'kelmaganlar';
}) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();
  const initial = useMemo(() => Object.fromEntries(marks.map((m) => [m.studentId, { status: m.status as St, reason: m.reason ?? '', reasonId: m.reasonId ?? null }])), [marks]);
  const [state, setState] = useState<Record<number, { status: St; reason: string; reasonId: number | null }>>(initial);
  const [topic, setTopic] = useState(lesson?.topic ?? '');
  const [teacherStatus, setTeacherStatus] = useState(lesson?.teacherStatus ?? 'vaqtida');
  const [teacherTouched, setTeacherTouched] = useState(false);
  const [call, setCall] = useState<(typeof absents)[number] | null>(null);
  useEffect(() => {
    setState(initial);
    setTopic(lesson?.topic ?? '');
    setTeacherStatus(lesson?.teacherStatus ?? 'vaqtida');
    setTeacherTouched(false);
  }, [initial, lesson]);

  const nav = (g: number | null, d: string, t?: string) => {
    const p = new URLSearchParams();
    if (g) p.set('guruh', String(g));
    p.set('sana', d);
    if (t) p.set('tab', t);
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };

  const done = members.filter((m) => state[m.id]).length;
  const absentCount = members.filter((m) => state[m.id]?.status === 'kelmadi').length;
  const isMarked = marks.length > 0;
  const notCalled = absents.filter((a) => !a.called).length;

  const save = () => {
    if (!group) return;
    const missing = members.filter((m) => !state[m.id]);
    if (missing.length) return toast(`${missing.length} ta o'quvchi belgilanmagan`, 'err');
    start(async () => {
      const r = await saveAttendance({ groupId: group.id, date, marks: members.map((m) => ({ studentId: m.id, status: state[m.id].status, reason: state[m.id].reason || null, reasonId: state[m.id].status === 'sababli' ? state[m.id].reasonId : null })), topic, teacherStatus: canSetTeacher && teacherTouched ? teacherStatus : undefined });
      if (r.ok) {
        toast(absentCount ? `Davomat saqlandi. ${absentCount} ta kelmaganga qo'ng'iroq qiling.` : 'Davomat saqlandi');
        router.refresh();
      } else toast(r.error, 'err');
    });
  };

  return (
    <>
      <PageHeader title="Davomat" sub="Har bir darsdan keyin 15 daqiqa ichida belgilang" />
      <div className="mb-5 inline-flex rounded-field border border-line bg-white p-1">
        <button onClick={() => nav(group?.id ?? null, date)} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'belgilash' ? 'bg-ink text-white' : 'text-fg-muted')}>
          Belgilash
        </button>
        <button onClick={() => nav(group?.id ?? null, date, 'kelmaganlar')} className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === 'kelmaganlar' ? 'bg-ink text-white' : 'text-fg-muted')}>
          Kelmaganlarga qo&apos;ng&apos;iroq
          {notCalled > 0 && <span className={cn('rounded-full px-1.5 text-xs tnum', tab === 'kelmaganlar' ? 'bg-white/20' : 'bg-bad-soft text-bad')}>{notCalled}</span>}
        </button>
      </div>

      {tab === 'kelmaganlar' ? (
        <Card>
          {absents.length === 0 ? (
            <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="Oxirgi 2 haftada hamma darsga kelgan" />
          ) : (
            <ul className="divide-y divide-line">
              {absents.map((a) => (
                <li key={a.id} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center', a.called && 'opacity-60')}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={a.name} size={36} />
                    <div className="min-w-0">
                      <Link href={`/oquvchilar?id=${a.studentId}`} className="truncate text-sm font-bold hover:text-brand">
                        {a.name}
                      </Link>
                      <div className="text-xs text-fg-muted">
                        {a.group}, {fmtDate(a.date)}
                        {a.reason && `, sabab: ${a.reason}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                    {(a.parentPhone || a.phone) && (
                      <a href={`tel:+${a.parentPhone || a.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold tnum hover:bg-canvas">
                        <Phone className="h-3.5 w-3.5" /> {phone(a.parentPhone || a.phone)}
                      </a>
                    )}
                    {a.called ? (
                      <Badge tone="good">Qo&apos;ng&apos;iroq qilindi</Badge>
                    ) : (
                      <Button size="sm" onClick={() => setCall(a)}>
                        <PhoneCall className="h-3.5 w-3.5" /> Natijani yozish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <Empty icon={<CalendarCheck className="h-5 w-5" />} title="Sizga biriktirilgan faol guruh yo'q" text="Guruhlar bo'limida guruh ochilib, o'qituvchi biriktirilgach davomat shu yerda belgilanadi." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            <div className="card flex items-center justify-between gap-2 p-2">
              <Button size="icon" variant="ghost" onClick={() => nav(group?.id ?? null, addDays(date, -1))} aria-label="Oldingi kun">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <label className="relative flex-1 text-center">
                <div className="text-sm font-bold">{date === todayStr ? 'Bugun' : WEEKDAYS_FULL[weekday(date)]}</div>
                <div className="text-xs text-fg-muted">{fmtDate(date)}</div>
                <input type="date" value={date} onChange={(e) => e.target.value && nav(group?.id ?? null, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Sana" />
              </label>
              <Button size="icon" variant="ghost" onClick={() => nav(group?.id ?? null, addDays(date, 1))} disabled={date >= todayStr} aria-label="Keyingi kun">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="card divide-y divide-line overflow-hidden">
              {[...groups].sort((a, b) => Number(b.today) - Number(a.today)).map((g) => (
                <button key={g.id} onClick={() => nav(g.id, date)} className={cn('flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors', group?.id === g.id ? 'bg-brand-soft' : 'hover:bg-canvas', !g.today && 'opacity-60')}>
                  <span className="h-8 w-1 rounded-full" style={{ background: g.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{g.name}</div>
                    <div className="truncate text-xs text-fg-muted tnum">
                      {g.start}, {g.today ? 'dars kuni' : 'dars yo\'q'}
                    </div>
                  </div>
                  {markedIds.includes(g.id) && <CheckCircle2 className="h-4 w-4 shrink-0 text-good" />}
                </button>
              ))}
            </div>
          </aside>

          {group && (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold">{group.name}</h2>
                  <p className="text-[13px] text-fg-muted">
                    {group.course}, {group.start}–{group.end}
                    {group.teacher && `, ${group.teacher}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isMarked && <Badge tone="good">Saqlangan</Badge>}
                  <Button size="sm" variant="soft" onClick={() => setState(Object.fromEntries(members.map((m) => [m.id, { status: 'keldi' as St, reason: '', reasonId: null }])))}>
                    <CheckCheck className="h-4 w-4" /> Hammasi keldi
                  </Button>
                </div>
              </div>
              {members.length === 0 ? (
                <Empty title="Bu sanada guruhda o'quvchi yo'q" text="O'quvchilar bo'limidan o'quvchini guruhga yozing." />
              ) : (
                <ul className="divide-y divide-line">
                  {members.map((m, i) => {
                    const s = state[m.id];
                    return (
                      <li key={m.id} className="px-4 py-3 sm:px-5">
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="w-5 text-right text-xs font-bold text-fg-faint tnum">{i + 1}</span>
                            <span className="truncate text-sm font-bold">{m.name}</span>
                            {m.status === 'xavf' && <Badge tone="warn">Xavf</Badge>}
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 sm:flex">
                            {OPTS.map((o) => (
                              <button
                                key={o.k}
                                onClick={() => setState((x) => ({ ...x, [m.id]: { status: o.k, reason: x[m.id]?.reason ?? '', reasonId: x[m.id]?.reasonId ?? null } }))}
                                className={cn('h-10 rounded-field border px-3 text-[13px] font-bold transition-colors sm:h-9', s?.status === o.k ? o.on : 'border-line-strong bg-white text-fg-muted hover:text-fg')}
                                aria-pressed={s?.status === o.k}
                              >
                                {o.l}
                              </button>
                            ))}
                          </div>
                        </div>
                        {s?.status === 'sababli' && reasonOpts.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 sm:ml-8">
                            {reasonOpts.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setState((x) => ({ ...x, [m.id]: { ...x[m.id], reasonId: x[m.id].reasonId === r.id ? null : r.id, reason: x[m.id].reasonId === r.id ? '' : r.title } }))}
                                className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', s.reasonId === r.id ? 'border-ink bg-ink text-white' : 'border-line-strong text-fg-muted')}
                              >
                                {r.title}
                                {billing === 'dars' && r.charges && <span className="ml-1 opacity-70">· pulli</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {(s?.status === 'kelmadi' || s?.status === 'sababli') && (
                          <input
                            value={s.reason}
                            onChange={(e) => setState((x) => ({ ...x, [m.id]: { ...x[m.id], reason: e.target.value } }))}
                            className="field mt-2.5 h-9 sm:ml-8 sm:w-[calc(100%-2rem)]"
                            placeholder="Sababi (agar ma'lum bo'lsa)"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="space-y-3 border-t border-line bg-canvas/60 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                  <label className="block">
                    <span className="label">Dars mavzusi</span>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} className="field" placeholder="Dars reja bo'yicha bugungi mavzu" />
                  </label>
                  {canSetTeacher && (
                    <label className="block">
                      <span className="label">O&apos;qituvchi</span>
                      <select value={teacherStatus} onChange={(e) => { setTeacherStatus(e.target.value); setTeacherTouched(true); }} className="field">
                        <option value="vaqtida">Vaqtida keldi</option>
                        <option value="kechikdi">Kechikdi</option>
                        <option value="otilmadi">Dars o&apos;tilmadi</option>
                      </select>
                    </label>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[13px] text-fg-muted tnum">
                    {done}/{members.length} belgilandi{absentCount ? `, ${absentCount} kelmadi` : ''}
                  </span>
                  <Button size="lg" onClick={save} disabled={pending || !members.length}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />} Davomatni saqlash
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal open={!!call} onClose={() => setCall(null)} title="Qo'ng'iroq natijasi" sub={call ? `${call.name}, ${fmtDate(call.date)}` : undefined} size="sm">
        {call && <CallForm a={call} onDone={() => setCall(null)} />}
      </Modal>
    </>
  );
}

function CallForm({ a, onDone }: { a: { id: number; reason: string | null }; onDone: () => void }) {
  const [reason, setReason] = useState(a.reason ?? '');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const quick = ['Kasal', 'Oilaviy sabab', 'Maktabda tadbir', 'Unutib qoldi', "Qiziqishi yo'qolgan", "Telefon ko'tarmadi"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setReason(q)} className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', reason === q ? 'border-ink bg-ink text-white' : 'border-line-strong text-fg-muted')}>
            {q}
          </button>
        ))}
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="field" placeholder="Nima deyishdi" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Bekor qilish
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await markCalled(a.id, reason);
              if (r.ok) {
                toast(r.message || 'Saqlandi');
                router.refresh();
                onDone();
              } else toast(r.error, 'err');
            })
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
        </Button>
      </div>
    </div>
  );
}
