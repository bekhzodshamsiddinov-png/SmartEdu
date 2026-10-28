'use client';
import { ResultForm, ResultList, type ResultRow } from '@/components/results';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, UserPlus, Users, Wallet, Pencil, ArrowRightLeft, Phone, Plus, Trash2, Download, LogOut as LeaveIcon, Receipt, Link2, FileText, Award, Coins, Copy, Ticket } from 'lucide-react';
import type { Role } from '@/db/schema';
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Drawer, Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { EditStudentForm, GroupSelect, NewStudentForm, PaymentForm, StatusForm, type GroupOpt } from '@/components/forms';
import { addGrade, addNote, deleteStudent, endEnrollment, enroll, updateFee, updateReturn } from '@/app/actions/students';
import { CancelPaymentButton } from '@/components/cancel-payment';
import { createCabinetLink, giveCoins, revokeCabinetLink } from '@/app/actions/cabinet';
import { useToast } from '@/components/toast';
import { PlanCard, type PlanLite } from '@/components/plan-card';
import { sellSubscription } from '@/app/actions/subscriptions';
import { ATT_LABEL, NOTE_KINDS, PAY_METHOD_LABEL, RESULT_TYPES, RETURN_RESULTS, STUDENT_STATUS } from '@/lib/constants';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtMonth, fmtShort, relative, today } from '@/lib/dates';

export type StudentRow = {
  id: number;
  fullName: string;
  phone: string | null;
  parentPhone: string | null;
  status: keyof typeof STUDENT_STATUS;
  joinedAt: string;
  groups: { id: number; name: string; course: string; courseId: number; color: string; current: boolean }[];
  balance: number;
  fee: number;
  teacherIds: number[];
  enrollments: { id: number; label: string }[];
};

export type Profile = {
  student: Record<string, string | number | null> & { id: number; fullName: string; status: keyof typeof STUDENT_STATUS };
  enrollments: { id: number; group: string; groupId: number; course: string; color: string; fee: number; startDate: string; endDate: string | null; active: boolean }[];
  payments: { id: number; amount: number; method: string; paidAt: string; forMonth: string | null; note: string | null; by: string | null; cancelled: boolean; cancelReason: string | null }[];
  attendance: { id: number; date: string; status: string; reason: string | null; group: string }[];
  grades: { id: number; period: string; score: number; comment: string | null; by: string | null }[];
  notes: { id: number; kind: string; text: string; createdAt: string; by: string | null }[];
  results: ResultRow[];
  balance: { charged: number; paid: number; balance: number; fee: number };
  attRate: number | null;
  ledger: { id: number; date: string; kind: string; amount: number; note: string | null; grp: string | null; status: string | null }[];
  freezeReasons: string[];
  subscriptions: { id: number; name: string; kind: string; start_date: string; end_date: string; lessons_total: number; used: number; price: number; status: string; grp: string }[];
  plans: (PlanLite & { course_id: number | null })[];
  coins: { total: number; rows: { amount: number; reason: string; d: string; by: string | null }[] };
};

const FILTERS = [
  { k: '', l: 'Hammasi' },
  { k: 'faol', l: 'Faol' },
  { k: 'xavf', l: 'Xavf ostida' },
  { k: 'qarzdor', l: 'Qarzdor' },
  { k: 'muzlatilgan', l: 'Muzlatilgan' },
  { k: 'ketgan', l: 'Ketgan' },
  { k: 'bitirgan', l: 'Bitirgan' },
];

export function StudentsView({
  rows,
  profile,
  groups,
  courses,
  role,
  showMoney,
  openNew,
  initial,
}: {
  rows: StudentRow[];
  profile: Profile | null;
  groups: GroupOpt[];
  courses: { id: number; name: string; color: string }[];
  role: Role;
  showMoney: boolean;
  openNew: boolean;
  initial: { q: string; holat: string; yonalish: string; guruh: string };
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [holat, setHolat] = useState(initial.holat);
  const [yonalish, setYonalish] = useState(initial.yonalish);
  const [guruh, setGuruh] = useState(initial.guruh);
  const [creating, setCreating] = useState(openNew);
  const canEdit = role === 'rahbar' || role === 'admin' || role === 'sotuv';

  useEffect(() => setCreating(openNew), [openNew]);

  useEffect(() => {
    const p = new URLSearchParams(params.toString());
    const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    set('q', q);
    set('holat', holat);
    set('yonalish', yonalish);
    set('guruh', guruh);
    const s = p.toString();
    window.history.replaceState(null, '', s ? `${path}?${s}` : path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, holat, yonalish, guruh]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': rows.length, qarzdor: 0 };
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.balance < 0 && (r.status === 'faol' || r.status === 'xavf')) c.qarzdor++;
    }
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const t = q.toLowerCase().trim();
    const d = q.replace(/\D/g, '');
    return rows.filter((r) => {
      if (holat === 'qarzdor') {
        if (!(r.balance < 0 && (r.status === 'faol' || r.status === 'xavf'))) return false;
      } else if (holat && r.status !== holat) return false;
      if (yonalish && !r.groups.some((g) => String(g.courseId) === yonalish)) return false;
      if (guruh && !r.groups.some((g) => String(g.id) === guruh)) return false;
      if (t && !r.fullName.toLowerCase().includes(t) && !(d.length >= 3 && ((r.phone ?? '').includes(d) || (r.parentPhone ?? '').includes(d)))) return false;
      return true;
    });
  }, [rows, q, holat, yonalish, guruh]);

  const open = (id: number) => {
    const p = new URLSearchParams(window.location.search);
    p.set('id', String(id));
    p.delete('yangi');
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };
  const close = () => {
    const p = new URLSearchParams(window.location.search);
    p.delete('id');
    p.delete('yangi');
    const s = p.toString();
    router.push(s ? `${path}?${s}` : path, { scroll: false });
  };

  const exportCsv = () => {
    const head = ['Ism', 'Telefon', 'Ota-ona telefoni', 'Holat', 'Guruh', "Yo'nalish", 'Balans', "Qo'shilgan"];
    const lines = list.map((r) => [r.fullName, r.phone ?? '', r.parentPhone ?? '', STUDENT_STATUS[r.status].label, r.groups.map((g) => g.name).join('; '), r.groups.map((g) => g.course).join('; '), String(r.balance), r.joinedAt]);
    const csv = [head, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `oquvchilar-${today()}.csv`;
    a.click();
  };

  return (
    <>
      <PageHeader
        title="O'quvchilar"
        sub={`${counts.faol ?? 0} faol, ${counts.xavf ?? 0} xavf ostida, jami ${rows.length}`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Excel (CSV)
            </Button>
            {canEdit && (
              <Button onClick={() => setCreating(true)}>
                <UserPlus className="h-4 w-4" /> O&apos;quvchi qo&apos;shish
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki telefon raqam" className="field pl-9" aria-label="O'quvchi qidirish" />
            </div>
            <select value={yonalish} onChange={(e) => setYonalish(e.target.value)} className="field md:w-56" aria-label="Yo'nalish">
              <option value="">Barcha yo&apos;nalishlar</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={guruh} onChange={(e) => setGuruh(e.target.value)} className="field md:w-52" aria-label="Guruh">
              <option value="">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {FILTERS.filter((f) => f.k !== 'qarzdor' || showMoney).map((f) => (
              <button
                key={f.k}
                onClick={() => setHolat(f.k)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                  holat === f.k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted hover:text-fg',
                )}
              >
                {f.l}
                <span className={cn('tnum text-xs', holat === f.k ? 'text-white/70' : 'text-fg-faint')}>{counts[f.k] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <Empty
            icon={<Users className="h-5 w-5" />}
            title={rows.length ? "Bu filtr bo'yicha o'quvchi yo'q" : "Hali o'quvchi qo'shilmagan"}
            text={rows.length ? "Filtrni o'zgartiring yoki qidiruvni tozalang." : "Birinchi o'quvchini qo'shing va uni guruhga yozing."}
            action={!rows.length && canEdit ? <Button onClick={() => setCreating(true)}>O&apos;quvchi qo&apos;shish</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="border-b border-line bg-canvas/60">
                  <tr>
                    <th className="th">O&apos;quvchi</th>
                    <th className="th">Guruh</th>
                    <th className="th">Holat</th>
                    {showMoney && <th className="th text-right">Balans</th>}
                    <th className="th text-right">Qo&apos;shilgan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((r) => (
                    <tr key={r.id} onClick={() => open(r.id)} className="cursor-pointer hover:bg-canvas/70">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.fullName} size={34} color={r.groups[0]?.color} />
                          <div className="min-w-0">
                            <div className="truncate font-bold">{r.fullName}</div>
                            <div className="text-xs text-fg-muted tnum">{phone(r.phone || r.parentPhone)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {r.groups.length ? (
                          <div className="space-y-0.5">
                            {r.groups.map((g) => (
                              <div key={g.id} className={cn('text-[13px]', !g.current && 'text-fg-faint')}>
                                <span className="font-semibold">{g.name}</span> <span className="text-fg-muted">{g.course}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[13px] text-fg-faint">Guruhsiz</span>
                        )}
                      </td>
                      <td className="td">
                        <Badge tone={STUDENT_STATUS[r.status].tone} dot>
                          {STUDENT_STATUS[r.status].label}
                        </Badge>
                      </td>
                      {showMoney && (
                        <td className={cn('td text-right font-bold tnum', r.balance < 0 ? 'text-bad' : r.balance > 0 ? 'text-good' : 'text-fg-faint')}>
                          {r.balance === 0 ? '0' : money(r.balance)}
                        </td>
                      )}
                      <td className="td text-right text-[13px] text-fg-muted">{fmtShort(r.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {list.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(r.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <Avatar name={r.fullName} size={40} color={r.groups[0]?.color} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{r.fullName}</div>
                      <div className="truncate text-xs text-fg-muted">{r.groups.map((g) => g.name).join(', ') || 'Guruhsiz'}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone={STUDENT_STATUS[r.status].tone}>{STUDENT_STATUS[r.status].label}</Badge>
                      {showMoney && r.balance < 0 && <div className="mt-1 text-xs font-bold text-bad tnum">{money(r.balance)}</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal open={creating} onClose={() => (openNew ? close() : setCreating(false))} title="Yangi o'quvchi" sub="Ma'lumotlarni kiriting va guruhga yozing">
        <NewStudentForm groups={groups} onCancel={() => (openNew ? close() : setCreating(false))} onDone={() => (openNew ? close() : setCreating(false))} />
      </Modal>

      {profile && <ProfileDrawer p={profile} groups={groups} role={role} showMoney={showMoney} onClose={close} />}
    </>
  );
}

const TABS = [
  { k: 'umumiy', l: 'Umumiy' },
  { k: 'tolov', l: "To'lovlar" },
  { k: 'davomat', l: 'Davomat' },
  { k: 'baho', l: 'Baholar' },
  { k: 'izoh', l: "Qo'ng'iroq va izohlar" },
  { k: 'natija', l: 'Natijalar' },
];

const KIND_LABEL: Record<string, string> = { oylik: 'Oylik to\'lov', dars: 'Dars', tuzatish: 'Tuzatish' };

/** Hisob daftari: yechimlar va to'lovlar bitta ro'yxatda, har qatordan keyingi qoldiq bilan */
function Ledger({ p }: { p: Profile }) {
  type Row = { key: string; date: string; title: string; sub: string; amount: number };
  const rows: Row[] = [
    ...p.ledger.map((c) => ({
      key: 'c' + c.id,
      date: c.date,
      title: c.kind === 'dars' ? `Dars${c.status ? ` (${ATT_LABEL[c.status as keyof typeof ATT_LABEL]?.label.toLowerCase() ?? c.status})` : ''}` : KIND_LABEL[c.kind] ?? c.kind,
      sub: [c.grp, c.note].filter(Boolean).join(', '),
      amount: -c.amount,
    })),
    ...p.payments.filter((x) => !x.cancelled).map((x) => ({ key: 'p' + x.id, date: x.paidAt, title: "To'lov", sub: PAY_METHOD_LABEL[x.method] ?? x.method, amount: x.amount })),
  ].sort((a, b) => (a.date === b.date ? (a.amount > b.amount ? 1 : -1) : a.date < b.date ? 1 : -1));
  // Qoldiq: eng yangi qatorda — joriy balans, pastga qarab orqaga hisoblanadi
  let run = p.balance.balance;
  const withBal = rows.map((r) => {
    const after = run;
    run -= r.amount;
    return { ...r, after };
  });
  const lessonPrice = p.ledger.find((c) => c.kind === 'dars' && c.amount > 0)?.amount;
  const bal = p.balance.balance;
  return (
    <Section title="Hisob daftari">
      {bal > 0 && (
        <p className="border-b border-line bg-good-soft px-4 py-2.5 text-[13px] text-good">
          Oldindan to&apos;langan: {money(bal)}
          {lessonPrice ? ` — taxminan ${Math.floor(bal / lessonPrice)} ta darsga yetadi` : p.balance.fee ? ` — taxminan ${(bal / p.balance.fee).toFixed(1)} oyga yetadi` : ''}
        </p>
      )}
      {withBal.length === 0 ? (
        <p className="px-4 py-4 text-sm text-fg-muted">Hali yozuv yo&apos;q.</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
          {withBal.map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="w-14 shrink-0 text-xs text-fg-muted tnum">{fmtShort(r.date)}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{r.title}</div>
                {r.sub && <div className="truncate text-xs text-fg-muted">{r.sub}</div>}
              </div>
              <div className="text-right tnum">
                <div className={cn('font-bold', r.amount > 0 ? 'text-good' : r.amount < 0 ? 'text-fg' : 'text-fg-muted')}>
                  {r.amount > 0 ? '+' : r.amount < 0 ? '−' : ''}
                  {money(Math.abs(r.amount))}
                </div>
                <div className={cn('text-[11px]', r.after < 0 ? 'text-bad' : 'text-fg-muted')}>qoldiq {r.after < 0 ? '−' : ''}{money(Math.abs(r.after))}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ProfileDrawer({ p, groups, role, showMoney, onClose }: { p: Profile; groups: GroupOpt[]; role: Role; showMoney: boolean; onClose: () => void }) {
  const s = p.student;
  const [tab, setTab] = useState('umumiy');
  const [modal, setModal] = useState<null | 'pay' | 'status' | 'edit' | 'enroll' | 'grade' | 'result' | 'return' | 'cabinet' | 'coin' | 'sub' | { fee: number; id: number }>(null);
  const canPay = role === 'rahbar' || role === 'admin' || role === 'bugalter';
  const canManage = role === 'rahbar' || role === 'admin';
  const st = STUDENT_STATUS[s.status];
  const current = p.enrollments.filter((e) => e.active && !e.endDate);

  return (
    <Drawer
      open
      onClose={onClose}
      title={s.fullName}
      header={
        <div className="flex items-center gap-3.5">
          <Avatar name={s.fullName} size={48} color={current[0]?.color} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-extrabold">{s.fullName}</h2>
              <Badge tone={st.tone} dot>
                {st.label}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-fg-muted tnum">
              {s.phone && (
                <a href={`tel:+${s.phone}`} className="inline-flex items-center gap-1 hover:text-brand">
                  <Phone className="h-3.5 w-3.5" /> {phone(s.phone as string)}
                </a>
              )}
              {s.parentPhone && (
                <a href={`tel:+${s.parentPhone}`} className="inline-flex items-center gap-1 hover:text-brand">
                  Ota-ona: {phone(s.parentPhone as string)}
                </a>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-line bg-white px-5 py-3">
        {canPay && (
          <Button size="sm" onClick={() => setModal('pay')}>
            <Wallet className="h-4 w-4" /> To&apos;lov qabul qilish
          </Button>
        )}
        {role !== 'bugalter' && (
          <Button size="sm" variant="secondary" onClick={() => setModal('status')}>
            <ArrowRightLeft className="h-4 w-4" /> Holatni o&apos;zgartirish
          </Button>
        )}
        {(canManage || role === 'sotuv') && (
          <Button size="sm" variant="secondary" onClick={() => setModal('edit')}>
            <Pencil className="h-4 w-4" /> Tahrirlash
          </Button>
        )}
        {canManage && p.plans.length > 0 && current.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setModal('sub')}>
            <Ticket className="h-4 w-4" /> Abonement
          </Button>
        )}
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setModal('cabinet')}>
            <Link2 className="h-4 w-4" /> Ota-ona kabineti
          </Button>
        )}
        {(canManage || role === 'sotuv') && (
          <a href={`/hujjat/shartnoma/${s.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-field px-2.5 text-[13px] font-bold text-fg-muted hover:bg-canvas hover:text-fg">
            <FileText className="h-4 w-4" /> Shartnoma
          </a>
        )}
        {s.status === 'bitirgan' && role !== 'bugalter' && (
          <a href={`/hujjat/sertifikat/${s.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-field px-2.5 text-[13px] font-bold text-fg-muted hover:bg-canvas hover:text-fg">
            <Award className="h-4 w-4" /> Sertifikat
          </a>
        )}
      </div>

      <div className="sticky top-0 z-10 -mb-px flex gap-1 overflow-x-auto border-b border-line bg-white px-3">
        {TABS.filter((t) => t.k !== 'tolov' || showMoney).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn('shrink-0 border-b-2 px-3 py-3 text-[13px] font-bold transition-colors', tab === t.k ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg')}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-5">
        {tab === 'umumiy' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {showMoney && (
                <MiniStat label="Balans" value={p.balance.balance === 0 ? '0' : money(p.balance.balance)} tone={p.balance.balance < 0 ? 'bad' : p.balance.balance > 0 ? 'good' : undefined} />
              )}
              <MiniStat label="Davomat" value={p.attRate === null ? '—' : `${p.attRate}%`} tone={p.attRate !== null && p.attRate < 80 ? 'warn' : undefined} />
              <MiniStat label="Natijalar" value={String(p.results.length)} />
            </div>

            <Section
              title="Guruhlari"
              action={
                canManage && (
                  <Button size="sm" variant="ghost" onClick={() => setModal('enroll')}>
                    <Plus className="h-4 w-4" /> Guruhga qo&apos;shish
                  </Button>
                )
              }
            >
              {p.enrollments.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-muted">Hali hech qaysi guruhga yozilmagan.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.enrollments.map((e) => {
                    const on = e.active && !e.endDate;
                    return (
                      <li key={e.id} className={cn('flex items-center gap-3 px-4 py-3', !on && 'opacity-60')}>
                        <span className="h-8 w-1 rounded-full" style={{ background: e.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">
                            {e.group} <span className="font-medium text-fg-muted">{e.course}</span>
                          </div>
                          <div className="text-xs text-fg-muted">
                            {fmtDate(e.startDate)} dan{e.endDate ? ` ${fmtDate(e.endDate)} gacha` : ''}
                            {showMoney && <>, oyiga {money(e.fee)}</>}
                          </div>
                        </div>
                        {on && canManage && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setModal({ fee: e.fee, id: e.id })}>
                              Narx
                            </Button>
                            <ActionButton variant="ghost" action={() => endEnrollment(e.id)} confirm="Guruhdan chiqarilsinmi? To'lov hisoblash shu kundan to'xtaydi." title="Guruhdan chiqarish">
                              <LeaveIcon className="h-4 w-4" />
                            </ActionButton>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {s.status === 'muzlatilgan' && (
              <Section title="Muzlatilgan">
                <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
                  <Info label="Sababi" value={s.leftReason as string} />
                  <Info label="Qaytish sanasi" value={s.freezeUntil ? fmtDate(s.freezeUntil as string) : null} />
                </dl>
              </Section>
            )}

            {s.status === 'ketgan' && (
              <Section
                title="Ketish ma'lumoti"
                action={
                  <Button size="sm" variant="ghost" onClick={() => setModal('return')}>
                    Qaytarish urinishi
                  </Button>
                }
              >
                <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
                  <Info label="Ketgan sana" value={fmtDate(s.leftAt as string)} />
                  <Info label="Sababi" value={s.leftReason as string} />
                  <Info label="Qaytarish urinishi" value={s.returnAttempt as string} />
                  <Info label="Natija" value={s.returnResult as string} />
                </dl>
              </Section>
            )}

            {p.subscriptions.length > 0 && (
              <Section title="Abonementlar">
                <ul className="divide-y divide-line">
                  {p.subscriptions.map((x) => {
                    const t = today();
                    const ended = x.status !== 'faol' || x.end_date < t || (x.kind === 'dars' && x.used >= x.lessons_total);
                    return (
                      <li key={x.id} className={cn('px-4 py-3', ended && 'opacity-60')}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <b>{x.name}</b>
                          <Badge tone={x.status === 'faol' && !ended ? 'good' : 'neutral'}>{x.status === 'bekor' ? 'Bekor' : x.status === 'toxtatildi' ? "To'xtatilgan" : ended ? 'Tugagan' : 'Faol'}</Badge>
                        </div>
                        <div className="text-xs text-fg-muted">
                          {x.grp} · {fmtShort(x.start_date)} — {fmtDate(x.end_date)}
                          {x.kind === 'dars' && ` · ${x.used}/${x.lessons_total} dars`}
                          {showMoney && ` · ${money(x.price)}`}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            <Section
              title={`Coin: ${p.coins.total}`}
              action={
                role !== 'bugalter' && role !== 'sotuv' && (
                  <Button size="sm" variant="ghost" onClick={() => setModal('coin')}>
                    <Coins className="h-4 w-4" /> Coin berish
                  </Button>
                )
              }
            >
              {p.coins.rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-fg-muted">Darsga kelgani va o&apos;z vaqtida to&apos;lagani uchun coin avtomatik beriladi.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.coins.rows.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {c.reason}
                        <span className="ml-2 text-xs text-fg-muted">
                          {fmtShort(c.d)}
                          {c.by && `, ${c.by}`}
                        </span>
                      </span>
                      <b className={cn('tnum', c.amount < 0 ? 'text-bad' : 'text-good')}>{c.amount > 0 ? `+${c.amount}` : c.amount}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Shaxsiy ma'lumotlar">
              <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
                <Info label="Ota-onasi" value={s.parentName as string} />
                <Info label="Tug'ilgan" value={s.birthDate ? fmtDate(s.birthDate as string) : s.birthYear ? String(s.birthYear) : null} />
                <Info label="Maktab / o'qish joyi" value={s.school as string} />
                <Info label="Qayerdan bildi" value={s.source as string} />
                <Info label="Manzil" value={s.address as string} />
                <Info label="Qo'shilgan" value={fmtDate(s.joinedAt as string)} />
                {s.note && <Info label="Izoh" value={s.note as string} className="sm:col-span-2" />}
              </dl>
            </Section>
            {role === 'rahbar' && (
              <div className="flex justify-end">
                <ActionButton variant="ghost" action={async () => { const r = await deleteStudent(s.id); if (r.ok) onClose(); return r; }} confirm="O'quvchi va uning barcha yozuvlari butunlay o'chiriladi. Davom etasizmi?">
                  <Trash2 className="h-4 w-4" /> O&apos;quvchini o&apos;chirish
                </ActionButton>
              </div>
            )}
          </>
        )}

        {tab === 'tolov' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Hisoblangan" value={money(p.balance.charged)} />
              <MiniStat label="To'langan" value={money(p.balance.paid)} />
              <MiniStat label={p.balance.balance < 0 ? 'Qarz' : 'Ortiqcha'} value={money(Math.abs(p.balance.balance))} tone={p.balance.balance < 0 ? 'bad' : 'good'} />
            </div>
            <Section title="To'lovlar tarixi" action={canPay && <Button size="sm" variant="ghost" onClick={() => setModal('pay')}><Plus className="h-4 w-4" /> Qabul qilish</Button>}>
              {p.payments.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-muted">Hali to&apos;lov qilinmagan.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.payments.map((x) => (
                    <li key={x.id} className={`flex items-center gap-3 px-4 py-3 ${x.cancelled ? 'opacity-60' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-bold tnum">
                          <span className={x.cancelled ? 'line-through' : ''}>{money(x.amount)}</span>
                          {x.cancelled && <Badge tone="bad">Bekor qilingan</Badge>}
                        </div>
                        {x.cancelled && x.cancelReason && <div className="text-xs text-bad">Sabab: {x.cancelReason}</div>}
                        <div className="text-xs text-fg-muted">
                          {fmtDate(x.paidAt)}, {PAY_METHOD_LABEL[x.method]}
                          {x.forMonth && `, ${fmtMonth(x.forMonth).toLowerCase()} uchun`}
                          {x.by && `, qabul qildi: ${x.by}`}
                          {x.note && `, ${x.note}`}
                        </div>
                      </div>
                      {!x.cancelled && (
                        <a href={`/chek/${x.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-fg-muted hover:bg-canvas hover:text-fg" title="Chek" aria-label="Chek chiqarish">
                          <Receipt className="h-4 w-4" />
                        </a>
                      )}
                      {role === 'rahbar' && !x.cancelled && <CancelPaymentButton id={x.id} amount={x.amount} who={fmtShort(x.paidAt)} />}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Ledger p={p} />
          </>
        )}

        {tab === 'davomat' && (
          <Section title="Oxirgi darslar">
            {p.attendance.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Davomat hali belgilanmagan.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 px-4 pt-4">
                  {[...p.attendance].reverse().slice(-40).map((a) => (
                    <span
                      key={a.id}
                      title={`${fmtDate(a.date)}: ${ATT_LABEL[a.status].label}`}
                      className={cn('h-5 w-5 rounded', { keldi: 'bg-good', kechikdi: 'bg-warn', kelmadi: 'bg-bad', sababli: 'bg-info' }[a.status])}
                    />
                  ))}
                </div>
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {p.attendance.slice(0, 20).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span>
                        {fmtDate(a.date)} <span className="text-fg-muted">{a.group}</span>
                        {a.reason && <span className="block text-xs text-fg-muted">Sabab: {a.reason}</span>}
                      </span>
                      <Badge tone={ATT_LABEL[a.status].tone}>{ATT_LABEL[a.status].label}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        {tab === 'baho' && (
          <Section title="Oylik baholar" action={role !== 'bugalter' && role !== 'sotuv' && <Button size="sm" variant="ghost" onClick={() => setModal('grade')}><Plus className="h-4 w-4" /> Baho qo&apos;yish</Button>}>
            {p.grades.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Hali baho qo&apos;yilmagan. O&apos;qituvchi har oy 100 ballik baho qo&apos;yadi.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.grades.map((g) => (
                  <li key={g.id} className="flex items-center gap-4 px-4 py-3">
                    <span className={cn('grid h-11 w-11 place-items-center rounded-xl text-[15px] font-extrabold tnum', g.score >= 80 ? 'bg-good-soft text-good' : g.score >= 60 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad')}>{g.score}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-bold">{fmtMonth(g.period)}</div>
                      <div className="text-xs text-fg-muted">
                        {g.comment || 'Izohsiz'}
                        {g.by && `, ${g.by}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === 'izoh' && (
          <>
            <Card className="p-4">
              <ActionForm action={addNote.bind(null, 'student', s.id)} submitLabel="Yozib qo'yish" resetOnSuccess>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(NOTE_KINDS).map(([k, l], i) => (
                    <label key={k} className="cursor-pointer">
                      <input type="radio" name="kind" value={k} defaultChecked={i === 1} className="peer sr-only" />
                      <span className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">{l}</span>
                    </label>
                  ))}
                </div>
                <textarea name="text" rows={3} className="field" placeholder="Masalan: Onasi bilan gaplashildi, ertaga darsga keladi" required />
              </ActionForm>
            </Card>
            <Section title="Tarix">
              {p.notes.length === 0 ? (
                <p className="px-4 py-4 text-sm text-fg-muted">Hali yozuv yo&apos;q.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.notes.map((n) => (
                    <li key={n.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-fg-muted">
                        <Badge tone={n.kind === 'qongiroq' ? 'info' : n.kind === 'ota_ona' ? 'brand' : 'neutral'}>{NOTE_KINDS[n.kind] ?? n.kind}</Badge>
                        <span>
                          {n.by && `${n.by}, `}
                          {relative(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        {tab === 'natija' && (
          <Section title="Yutuqlari" action={role !== 'bugalter' && role !== 'sotuv' && <Button size="sm" variant="ghost" onClick={() => setModal('result')}><Plus className="h-4 w-4" /> Yutuq qo&apos;shish</Button>}>
            <ResultList rows={p.results} canEdit={['rahbar', 'admin'].includes(role)} />
          </Section>
        )}
      </div>

      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title="To'lov qabul qilish" sub={s.fullName}>
        <PaymentForm
          students={[]}
          fixedStudent={{ id: s.id, name: s.fullName, debt: Math.max(0, -p.balance.balance), fee: p.balance.fee, enrollments: current.map((e) => ({ id: e.id, label: `${e.group} (${e.course})` })) }}
          onDone={() => setModal(null)}
          onCancel={() => setModal(null)}
        />
      </Modal>
      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Holatni o'zgartirish" sub={s.fullName}>
        <StatusForm studentId={s.id} current={s.status} groups={groups} freezeReasons={p.freezeReasons} onDone={() => setModal(null)} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'cabinet'} onClose={() => setModal(null)} title="Ota-ona kabineti" sub="Ota-ona parolsiz kiradi: balans, davomat, baholar, coinlar" size="sm">
        {modal === 'cabinet' && <CabinetLink id={s.id} active={!!s.cabinet} telegram={!!s.telegram} />}
      </Modal>
      <Modal open={modal === 'sub'} onClose={() => setModal(null)} title="Abonement rasmiylashtirish" sub={s.fullName} size="lg">
        {modal === 'sub' && <SellForm studentId={s.id} plans={p.plans} enrollments={p.enrollments.filter((e) => e.active && !e.endDate)} onDone={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === 'coin'} onClose={() => setModal(null)} title="Coin berish" size="sm">
        {modal === 'coin' && (
          <ActionForm action={giveCoins.bind(null, s.id)} onDone={() => setModal(null)} onCancel={() => setModal(null)}>
            <Field label="Nechta coin" hint="Olib qo'yish uchun minus bilan yozing, masalan -5">
              <input type="number" name="amount" min={-100} max={100} defaultValue={5} className="field" required />
            </Field>
            <Field label="Nima uchun">
              <input name="reason" maxLength={120} className="field" placeholder="Masalan: uy vazifasini a'lo bajardi" required />
            </Field>
          </ActionForm>
        )}
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Ma'lumotlarni tahrirlash">
        <EditStudentForm s={s} onDone={() => setModal(null)} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'enroll'} onClose={() => setModal(null)} title="Guruhga qo'shish" size="sm">
        <EnrollForm studentId={s.id} groups={groups} onDone={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Qaytarish urinishi" size="sm">
        <ActionForm action={updateReturn.bind(null, s.id)} onDone={() => setModal(null)} onCancel={() => setModal(null)}>
          <Field label="Nima qilindi">
            <textarea name="returnAttempt" rows={3} className="field" defaultValue={(s.returnAttempt as string) ?? ''} required />
          </Field>
          <Field label="Natija">
            <select name="returnResult" className="field" defaultValue={(s.returnResult as string) ?? ''} required>
              <option value="">Tanlang</option>
              {RETURN_RESULTS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </Modal>
      <Modal open={modal === 'grade'} onClose={() => setModal(null)} title="Oylik baho" size="sm">
        <ActionForm action={addGrade.bind(null, s.id)} onDone={() => setModal(null)} onCancel={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Oy">
              <input type="month" name="period" defaultValue={today().slice(0, 7)} className="field" required />
            </Field>
            <Field label="Baho (0–100)">
              <input type="number" name="score" min={0} max={100} className="field" required />
            </Field>
          </div>
          {current[0] && <input type="hidden" name="groupId" value={current[0].groupId} />}
          <Field label="Izoh">
            <textarea name="comment" rows={2} className="field" placeholder="Nimada kuchli, nimada qiynalyapti" />
          </Field>
        </ActionForm>
      </Modal>
      <Modal open={modal === 'result'} onClose={() => setModal(null)} title="Yutuq qo'shish" sub={s.fullName} size="sm">
        <ResultForm studentId={s.id} onDone={() => setModal(null)} />
      </Modal>
      <Modal open={typeof modal === 'object' && modal !== null} onClose={() => setModal(null)} title="Oylik to'lovni o'zgartirish" size="sm">
        {typeof modal === 'object' && modal !== null && (
          <ActionForm action={updateFee.bind(null, modal.id)} onDone={() => setModal(null)} onCancel={() => setModal(null)}>
            <Field label="Oylik to'lov" hint="Chegirma berilsa shu yerda kamaytiring.">
              <MoneyInput name="monthlyFee" defaultValue={modal.fee} required />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </Drawer>
  );
}

function EnrollForm({ studentId, groups, onDone }: { studentId: number; groups: GroupOpt[]; onDone: () => void }) {
  const [g, setG] = useState<GroupOpt | undefined>();
  return (
    <ActionForm action={enroll.bind(null, studentId)} onDone={onDone} onCancel={onDone}>
      <Field label="Guruh">
        <GroupSelect groups={groups} onChange={setG} optional={false} />
      </Field>
      {g && (
        <Field label="Oylik to'lov">
          <MoneyInput key={g.id} name="monthlyFee" defaultValue={g.fee} />
        </Field>
      )}
      <Field label="Boshlagan sana">
        <input type="date" name="startDate" defaultValue={today()} className="field" />
      </Field>
    </ActionForm>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'good' | 'warn' }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className={cn('mt-1 truncate text-[15px] font-extrabold tnum', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn')}>{value}</div>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value || '—'}</dd>
    </div>
  );
}

function CabinetLink({ id, active, telegram }: { id: number; active: boolean; telegram: boolean }) {
  const toast = useToast();
  const [link, setLink] = useState<{ url: string; app: string; bot: string | null } | null>(null);
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast('Nusxalandi');
    } catch {
      toast("Nusxalab bo'lmadi", 'err');
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        {active ? 'Kabinet havolasi berilgan.' : 'Hali havola berilmagan.'} {telegram ? 'Ota-ona Telegram botga ulangan.' : ''} Yangi havola yaratilsa, eskisi ishlamay qoladi.
      </p>
      {link && (
        <div className="space-y-2">
          <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-3">
            <div className="text-xs font-semibold text-fg-muted">Mobil ilova havolasi (tavsiya etiladi)</div>
            <div className="mt-1 break-all text-sm">{link.app}</div>
            <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => copy(link.app)}>
              <Copy className="h-4 w-4" /> Nusxa
            </Button>
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="text-xs font-semibold text-fg-muted">Kabinet havolasi (brauzerda)</div>
            <div className="mt-1 break-all text-sm">{link.url}</div>
            <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => copy(link.url)}>
              <Copy className="h-4 w-4" /> Nusxa
            </Button>
          </div>
          {link.bot && (
            <div className="rounded-xl border border-line p-3">
              <div className="text-xs font-semibold text-fg-muted">Telegram botga ulanish (xabarlar shu yerga keladi)</div>
              <div className="mt-1 break-all text-sm">{link.bot}</div>
              <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => copy(link.bot!)}>
                <Copy className="h-4 w-4" /> Nusxa
              </Button>
            </div>
          )}
          <p className="text-xs text-fg-muted">Havola faqat hozir ko&apos;rsatiladi — uni ota-onaga yuboring.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          action={async () => {
            const r = await createCabinetLink(id);
            if (r.ok && r.url) setLink({ url: r.url, app: r.app ?? r.url, bot: r.bot ?? null });
            return r;
          }}
          confirm={active ? "Eski havola ishlamay qoladi. Yangisini yaratamizmi?" : undefined}
        >
          <Link2 className="h-4 w-4" /> {active ? 'Yangi havola' : 'Havola yaratish'}
        </ActionButton>
        {active && (
          <ActionButton variant="ghost" action={revokeCabinetLink.bind(null, id)} confirm="Havola o'chirilsinmi? Ota-ona kabinetga kira olmaydi.">
            Havolani o&apos;chirish
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function SellForm({ studentId, plans, enrollments, onDone }: { studentId: number; plans: (PlanLite & { course_id: number | null })[]; enrollments: { id: number; group: string; course: string; groupId: number }[]; onDone: () => void }) {
  const [enr, setEnr] = useState(enrollments[0]?.id ?? 0);
  const [plan, setPlan] = useState<number | null>(null);
  const [pay, setPay] = useState(true);
  const course = enrollments.find((e) => e.id === enr)?.course;
  const fit = plans.filter((x) => !x.course || x.course === course);
  const chosen = fit.find((x) => x.id === plan);
  return (
    <ActionForm action={sellSubscription.bind(null, studentId)} onDone={onDone} onCancel={onDone} submitLabel={chosen ? `Rasmiylashtirish · ${money(chosen.price)}` : 'Rasmiylashtirish'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guruh">
          <select name="enrollmentId" value={enr} onChange={(e) => { setEnr(Number(e.target.value)); setPlan(null); }} className="field">
            {enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.group} ({e.course})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Boshlanish sanasi">
          <input type="date" name="startDate" defaultValue={today()} className="field" />
        </Field>
      </div>
      <input type="hidden" name="planId" value={plan ?? ''} />
      {fit.length === 0 ? (
        <p className="rounded-field bg-warn-soft px-3 py-2.5 text-sm text-warn">Bu yo&apos;nalish uchun paket yo&apos;q. Abonementlar bo&apos;limida qo&apos;shing.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fit.map((x) => (
            <PlanCard key={x.id} p={x} compact selected={plan === x.id} onClick={() => setPlan(x.id)} />
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pay" checked={pay} onChange={(e) => setPay(e.target.checked)} className="h-4 w-4 accent-[#0E7C6B]" /> To&apos;lovni hozir qabul qilish
      </label>
      {pay && (
        <Field label="To'lov usuli">
          <select name="method" defaultValue="naqd" className="field">
            {Object.entries(PAY_METHOD_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}
    </ActionForm>
  );
}
