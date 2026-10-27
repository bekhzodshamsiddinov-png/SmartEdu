'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DoorOpen, Pencil, Plus, Power } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { saveRoom, toggleRoom } from '@/app/actions/schedule';

type G = { id: number; name: string; days: string[]; start: string; end: string; room: string | null; capacity: number; teacherId: number | null; teacher: string | null; course: string; color: string; branchId: number | null; students: number; done: number; total: number };
type R = { id: number; name: string; capacity: number; active: boolean; branchId: number | null };

const DAYS = [
  { k: 'Du', l: 'Dushanba' },
  { k: 'Se', l: 'Seshanba' },
  { k: 'Chor', l: 'Chorshanba' },
  { k: 'Pa', l: 'Payshanba' },
  { k: 'Ju', l: 'Juma' },
  { k: 'Sha', l: 'Shanba' },
  { k: 'Ya', l: 'Yakshanba' },
];
const START = 8 * 60;
const END = 21 * 60;
const SLOT = 30;
const ROW = 26;
const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function ScheduleView({ day, groups, rooms, branches, currentBranch, canManage, meId }: { day: string; groups: G[]; rooms: R[]; branches: { id: number; name: string }[]; currentBranch: number | null; canManage: boolean; meId: number | null }) {
  const router = useRouter();
  const path = usePathname();
  const [teacher, setTeacher] = useState<number | 0>(meId ?? 0);
  const [edit, setEdit] = useState<R | 'new' | null>(null);
  const teachers = useMemo(() => [...new Map(groups.filter((g) => g.teacherId).map((g) => [g.teacherId!, g.teacher ?? ''])).entries()], [groups]);
  const todays = groups.filter((g) => g.days.includes(day) && (!teacher || g.teacherId === teacher));
  type Col = { key: string; name: string; branchId: number | null; cap?: number };
  const sameRoom = (c: Col, g: G) => (c.name ? g.room?.toLowerCase() === c.name.toLowerCase() : !g.room) && (!c.branchId || !g.branchId || c.branchId === g.branchId);
  const cols = useMemo(() => {
    const list: Col[] = rooms.filter((r) => r.active).map((r) => ({ key: `r${r.id}`, name: r.name, branchId: r.branchId, cap: r.capacity }));
    for (const g of todays) if (!list.some((c) => sameRoom(c, g))) list.push({ key: `g${g.room ?? ''}-${g.branchId ?? ''}`, name: g.room ?? '', branchId: g.branchId });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, todays]);
  const branchName = (id: number | null) => (id && branches.length > 1 && !currentBranch ? branches.find((b) => b.id === id)?.name : null);
  const slots = Array.from({ length: (END - START) / SLOT }, (_, i) => START + i * SLOT);
  const perDay = DAYS.map((d) => ({ ...d, n: groups.filter((g) => g.days.includes(d.k) && (!teacher || g.teacherId === teacher)).length }));

  return (
    <>
      <PageHeader
        title="Dars jadvali"
        sub="Xonalar bo'yicha haftalik jadval. Bir xonaga yoki bir o'qituvchiga bir vaqtda ikki guruh qo'yib bo'lmaydi."
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setEdit('new')}>
              <Plus className="h-4 w-4" /> Xona
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-field border border-line bg-white p-1">
          {perDay.map((d) => (
            <button
              key={d.k}
              type="button"
              onClick={() => router.replace(`${path}?kun=${d.k}`, { scroll: false })}
              className={cn('shrink-0 rounded-[7px] px-3 py-1.5 text-[13px] font-bold', day === d.k ? 'bg-ink text-white' : 'text-fg-muted')}
            >
              <span className="hidden sm:inline">{d.l}</span>
              <span className="sm:hidden">{d.k}</span>
              <span className="ml-1 opacity-60">{d.n}</span>
            </button>
          ))}
        </div>
        <select value={teacher} onChange={(e) => setTeacher(Number(e.target.value))} className="field h-10 lg:w-64" aria-label="O'qituvchi">
          <option value={0}>Barcha o&apos;qituvchilar</option>
          {teachers.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {todays.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-fg-muted">Bu kunda dars yo&apos;q.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: 64 + cols.length * 180 }}>
              <div className="sticky top-0 z-10 flex border-b border-line bg-canvas/80">
                <div className="w-16 shrink-0" />
                {cols.map((c) => (
                  <div key={c.key} className="flex-1 border-l border-line px-3 py-2 text-[13px] font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 text-fg-muted" /> {c.name || 'Xonasiz'}
                    </span>
                    {c.cap && <span className="ml-1.5 text-xs font-normal text-fg-muted">{c.cap} o&apos;rin</span>}
                    {branchName(c.branchId) && <div className="truncate text-[11px] font-normal text-fg-muted">{branchName(c.branchId)}</div>}
                  </div>
                ))}
              </div>
              <div className="flex">
                <div className="w-16 shrink-0">
                  {slots.map((s) => (
                    <div key={s} className="border-b border-line/60 pr-2 text-right text-[11px] text-fg-muted tnum" style={{ height: ROW }}>
                      {s % 60 === 0 ? `${String(s / 60).padStart(2, '0')}:00` : ''}
                    </div>
                  ))}
                </div>
                {cols.map((c) => (
                  <div key={c.key} className="relative flex-1 border-l border-line">
                    {slots.map((s) => (
                      <div key={s} className={cn('border-b', s % 60 === 0 ? 'border-line/60' : 'border-line/30')} style={{ height: ROW }} />
                    ))}
                    {todays
                      .filter((g) => sameRoom(c, g))
                      .map((g) => {
                        const top = ((Math.max(mins(g.start), START) - START) / SLOT) * ROW;
                        const h = ((Math.min(mins(g.end), END) - Math.max(mins(g.start), START)) / SLOT) * ROW;
                        const cap = c.cap || g.capacity;
                        return (
                          <Link
                            key={g.id}
                            href={`/guruhlar?id=${g.id}`}
                            className="absolute inset-x-1.5 overflow-hidden rounded-lg border-l-4 bg-white p-2 text-xs shadow-lift ring-1 ring-line hover:ring-line-strong"
                            style={{ top: top + 1, height: Math.max(h - 2, 24), borderLeftColor: g.color }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <b className="truncate text-[13px]">{g.name}</b>
                              <span className="shrink-0 text-fg-muted tnum">
                                {g.start}–{g.end}
                              </span>
                            </div>
                            <div className="truncate text-fg-muted">{g.course}</div>
                            <div className="truncate">{g.teacher ?? "O'qituvchi yo'q"}</div>
                            <div className="mt-1 flex gap-2 text-fg-muted tnum">
                              <span title="O'tilgan dars / jami">
                                {g.done}/{g.total} dars
                              </span>
                              <span className={g.students > cap ? 'font-bold text-bad' : ''} title="O'quvchi / sig'im">
                                {g.students}/{cap} o&apos;quvchi
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {canManage && (
        <Card className="mt-5">
          <CardHeader title="Xonalar" sub="Guruh ochishda xona shu ro'yxatdan tanlanadi" />
          <ul className="divide-y divide-line border-t border-line">
            {rooms.length === 0 && <li className="px-5 py-5 text-center text-sm text-fg-muted">Hali xona qo&apos;shilmagan</li>}
            {rooms.map((r) => (
              <li key={r.id} className={cn('flex items-center gap-3 px-5 py-2.5', !r.active && 'opacity-50')}>
                <DoorOpen className="h-4 w-4 text-fg-muted" />
                <div className="min-w-0 flex-1 text-sm">
                  <b>{r.name}</b>
                  <span className="ml-2 text-fg-muted">{r.capacity} o&apos;rin</span>
                  {branches.length > 1 && r.branchId && <span className="ml-2 text-xs text-fg-muted">{branches.find((b) => b.id === r.branchId)?.name}</span>}
                  {!r.active && <Badge className="ml-2">O&apos;chirilgan</Badge>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Tahrirlash">
                  <Pencil className="h-4 w-4" />
                </Button>
                <ActionButton variant="ghost" size="icon" action={() => toggleRoom(r.id)} title={r.active ? "O'chirish" : 'Yoqish'}>
                  <Power className="h-4 w-4" />
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi xona' : 'Xonani tahrirlash'} size="sm">
        {edit && (
          <ActionForm action={saveRoom.bind(null, edit === 'new' ? null : edit.id)} onDone={() => setEdit(null)} onCancel={() => setEdit(null)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nomi">
                <input name="name" defaultValue={edit === 'new' ? '' : edit.name} className="field" maxLength={40} placeholder="Masalan: 3-xona" required />
              </Field>
              <Field label="Sig'imi">
                <input type="number" name="capacity" min={1} max={500} defaultValue={edit === 'new' ? 12 : edit.capacity} className="field" />
              </Field>
            </div>
            {branches.length > 1 && (
              <Field label="Filial">
                <select name="branchId" defaultValue={edit === 'new' ? currentBranch ?? '' : edit.branchId ?? ''} className="field">
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
