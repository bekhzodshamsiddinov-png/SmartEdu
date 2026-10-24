'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, UserPlus, Users, Wallet, Pencil, ArrowRightLeft, Phone, Plus, Trash2, Download, LogOut as LeaveIcon } from 'lucide-react';
import type { Role } from '@/db/schema';
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Drawer, Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { EditStudentForm, GroupSelect, NewStudentForm, PaymentForm, StatusForm, type GroupOpt } from '@/components/forms';
import { addGrade, addNote, addResult, deleteStudent, endEnrollment, enroll, updateFee, updateReturn } from '@/app/actions/students';
import { deletePayment } from '@/app/actions/payments';
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
  payments: { id: number; amount: number; method: string; paidAt: string; forMonth: string | null; note: string | null; by: string | null }[];
  attendance: { id: number; date: string; status: string; reason: string | null; group: string }[];
  grades: { id: number; period: string; score: number; comment: string | null; by: string | null }[];
  notes: { id: number; kind: string; text: string; createdAt: string; by: string | null }[];
  results: { id: number; type: string; title: string; amount: number | null; date: string; note: string | null }[];
  balance: { charged: number; paid: number; balance: number; fee: number };
  attRate: number | null;
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

function ProfileDrawer({ p, groups, role, showMoney, onClose }: { p: Profile; groups: GroupOpt[]; role: Role; showMoney: boolean; onClose: () => void }) {
  const s = p.student;
  const [tab, setTab] = useState('umumiy');
  const [modal, setModal] = useState<null | 'pay' | 'status' | 'edit' | 'enroll' | 'grade' | 'result' | 'return' | { fee: number; id: number }>(null);
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

            <Section title="Shaxsiy ma'lumotlar">
              <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
                <Info label="Ota-onasi" value={s.parentName as string} />
                <Info label="Tug'ilgan yili" value={s.birthYear ? String(s.birthYear) : null} />
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
                    <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold tnum">{money(x.amount)}</div>
                        <div className="text-xs text-fg-muted">
                          {fmtDate(x.paidAt)}, {PAY_METHOD_LABEL[x.method]}
                          {x.forMonth && `, ${fmtMonth(x.forMonth).toLowerCase()} uchun`}
                          {x.by && `, qabul qildi: ${x.by}`}
                          {x.note && `, ${x.note}`}
                        </div>
                      </div>
                      {role === 'rahbar' && (
                        <ActionButton variant="ghost" size="icon" action={() => deletePayment(x.id)} confirm="Bu to'lov bekor qilinsinmi?" title="Bekor qilish">
                          <Trash2 className="h-4 w-4" />
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <p className="text-xs text-fg-muted">To&apos;lov har oyning boshida oldindan hisoblanadi: guruhdagi har bir oy uchun oylik to&apos;lov qo&apos;shiladi.</p>
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
          <Section title="Yutuqlari" action={role !== 'bugalter' && <Button size="sm" variant="ghost" onClick={() => setModal('result')}><Plus className="h-4 w-4" /> Natija qo&apos;shish</Button>}>
            {p.results.length === 0 ? (
              <p className="px-4 py-4 text-sm text-fg-muted">Olimpiada, birinchi zakaz, ishga kirish va portfolio proyektlarini shu yerga yozing.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.results.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{r.title}</span>
                      <Badge tone="brand">{r.type}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-fg-muted">
                      {fmtDate(r.date)}
                      {r.amount ? `, ${money(r.amount)}` : ''}
                      {r.note ? `, ${r.note}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
        <StatusForm studentId={s.id} current={s.status} groups={groups} onDone={() => setModal(null)} onCancel={() => setModal(null)} />
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
      <Modal open={modal === 'result'} onClose={() => setModal(null)} title="Natija qo'shish" size="sm">
        <ActionForm action={addResult.bind(null, s.id)} onDone={() => setModal(null)} onCancel={() => setModal(null)}>
          <Field label="Turi">
            <select name="type" className="field" required>
              {RESULT_TYPES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Natija">
            <input name="title" className="field" placeholder="Masalan: Viloyat olimpiadasi, 2-o'rin" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sana">
              <input type="date" name="date" defaultValue={today()} className="field" />
            </Field>
            <Field label="Daromad (agar bo'lsa)">
              <MoneyInput name="amount" />
            </Field>
          </div>
          <Field label="Izoh">
            <input name="note" className="field" />
          </Field>
        </ActionForm>
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
