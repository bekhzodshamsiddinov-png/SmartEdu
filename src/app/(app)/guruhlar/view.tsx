'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Layers, Plus, Pencil, Users, Clock, DoorOpen, ArrowRightLeft, Archive, RotateCcw, CalendarCheck, Send } from 'lucide-react';
import type { Role } from '@/db/schema';
import { Avatar, Badge, Button, Card, Empty, Field, LinkButton, PageHeader, Progress, cn } from '@/components/ui';
import { Drawer, Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { GroupSelect, type GroupOpt } from '@/components/forms';
import { closeGroup, moveStudent, reopenGroup, saveCourse, saveGroup } from '@/app/actions/groups';
import { logParentReport } from '@/app/actions/attendance';
import { DAY_CODES, fmtDate, fmtShort } from '@/lib/dates';
import { money, phone } from '@/lib/format';
import { STUDENT_STATUS } from '@/lib/constants';

type G = {
  id: number; name: string; courseId: number; course: string; color: string; teacherId: number | null; teacher: string | null;
  supportId: number | null; support: string | null; days: string; startTime: string; endTime: string; room: string | null;
  capacity: number; startDate: string | null; active: boolean; students: number;
};
type C = { id: number; name: string; price: number; duration: number; color: string; description: string | null; active: boolean; groups: number; students: number };
type Detail = {
  id: number;
  members: { enrollmentId: number; id: number; name: string; phone: string | null; parentPhone: string | null; status: keyof typeof STUDENT_STATUS; fee: number; startDate: string; balance: number; att: number | null }[];
  lessons: { id: number; date: string; topic: string | null; teacherStatus: string }[];
};

const COLORS = ['#008A70', '#3D6FD1', '#C2862A', '#B5487A', '#7A5BC7'];
const DAY_FULL: Record<string, string> = { Du: 'Dushanba', Se: 'Seshanba', Chor: 'Chorshanba', Pa: 'Payshanba', Ju: 'Juma', Sha: 'Shanba', Ya: 'Yakshanba' };

export function GroupsView({ groups, courses, teachers, groupOpts, detail, role, tab }: { groups: G[]; courses: C[]; teachers: { id: number; name: string; role: string }[]; groupOpts: GroupOpt[]; detail: Detail | null; role: Role; tab: 'guruhlar' | 'yonalishlar' }) {
  const router = useRouter();
  const path = usePathname();
  const [edit, setEdit] = useState<G | 'new' | null>(null);
  const [course, setCourse] = useState<C | 'new' | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const manage = role === 'rahbar' || role === 'admin';
  const list = groups.filter((g) => g.active || showClosed);
  const sel = detail ? groups.find((g) => g.id === detail.id) : null;

  return (
    <>
      <PageHeader
        title="Guruhlar"
        sub={`${groups.filter((g) => g.active).length} ta faol guruh, ${courses.filter((c) => c.active).length} ta yo'nalish`}
        actions={
          manage &&
          (tab === 'guruhlar' ? (
            <Button onClick={() => setEdit('new')}>
              <Plus className="h-4 w-4" /> Guruh ochish
            </Button>
          ) : (
            role === 'rahbar' && (
              <Button onClick={() => setCourse('new')}>
                <Plus className="h-4 w-4" /> Yo&apos;nalish qo&apos;shish
              </Button>
            )
          ))
        }
      />
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-field border border-line bg-white p-1">
          {[
            { k: 'guruhlar', l: 'Guruhlar' },
            { k: 'yonalishlar', l: "Yo'nalishlar va narxlar" },
          ].map((t) => (
            <Link key={t.k} href={t.k === 'guruhlar' ? path : `${path}?tab=yonalishlar`} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === t.k ? 'bg-ink text-white' : 'text-fg-muted hover:text-fg')}>
              {t.l}
            </Link>
          ))}
        </div>
        {tab === 'guruhlar' && (
          <label className="flex items-center gap-2 text-[13px] font-semibold text-fg-muted">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-4 w-4 accent-[#0E7C6B]" /> Yopilganlarni ham ko&apos;rsatish
          </label>
        )}
      </div>

      {tab === 'guruhlar' ? (
        list.length === 0 ? (
          <Card>
            <Empty icon={<Layers className="h-5 w-5" />} title="Hali guruh yo'q" text="Guruh oching: yo'nalish, o'qituvchi, dars kunlari va vaqtini belgilang." action={manage ? <Button onClick={() => setEdit('new')}>Guruh ochish</Button> : undefined} />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((g) => {
              const fill = Math.round((g.students / Math.max(1, g.capacity)) * 100);
              return (
                <button key={g.id} onClick={() => router.push(`${path}?id=${g.id}`, { scroll: false })} className={cn('card relative overflow-hidden p-4 text-left transition-colors hover:border-line-strong', !g.active && 'opacity-60')}>
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: g.color }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-extrabold">{g.name}</div>
                      <div className="truncate text-[13px] text-fg-muted">{g.course}</div>
                    </div>
                    {!g.active && <Badge>Yopilgan</Badge>}
                  </div>
                  <div className="mt-3 space-y-1.5 text-[13px]">
                    <div className="flex items-center gap-2 text-fg-muted">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-semibold text-fg tnum">
                        {g.startTime}–{g.endTime}
                      </span>
                      <span>{g.days.split(',').join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-fg-muted">
                      <Users className="h-3.5 w-3.5" />
                      <span className="truncate">{g.teacher ?? "O'qituvchi yo'q"}</span>
                      {g.room && (
                        <>
                          <DoorOpen className="ml-1 h-3.5 w-3.5" /> {g.room}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-semibold text-fg-muted">O&apos;quvchilar</span>
                      <span className="font-bold tnum">
                        {g.students}/{g.capacity}
                      </span>
                    </div>
                    <Progress value={fill} tone={fill >= 100 ? 'good' : fill < 50 ? 'warn' : 'brand'} />
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className="th">Yo&apos;nalish</th>
                  <th className="th text-right">Oylik narx</th>
                  <th className="th text-right">Davomiyligi</th>
                  <th className="th text-right">Guruhlar</th>
                  <th className="th text-right">O&apos;quvchilar</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {courses.map((c) => (
                  <tr key={c.id} className={cn(!c.active && 'opacity-50')}>
                    <td className="td">
                      <div className="flex items-center gap-2.5 font-bold">
                        <span className="h-3 w-3 rounded" style={{ background: c.color }} />
                        {c.name}
                        {!c.active && <Badge>Arxivda</Badge>}
                      </div>
                      {c.description && <div className="mt-0.5 pl-[22px] text-xs text-fg-muted">{c.description}</div>}
                    </td>
                    <td className="td text-right font-semibold tnum">{money(c.price)}</td>
                    <td className="td text-right tnum">{c.duration} oy</td>
                    <td className="td text-right tnum">{c.groups}</td>
                    <td className="td text-right tnum">{c.students}</td>
                    <td className="td text-right">
                      {role === 'rahbar' && (
                        <Button size="sm" variant="ghost" onClick={() => setCourse(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi guruh' : 'Guruhni tahrirlash'}>
        {edit && <GroupForm g={edit === 'new' ? null : edit} courses={courses.filter((c) => c.active)} teachers={teachers} onDone={() => setEdit(null)} />}
      </Modal>
      <Modal open={!!course} onClose={() => setCourse(null)} title={course === 'new' ? "Yangi yo'nalish" : "Yo'nalishni tahrirlash"} size="sm">
        {course && <CourseForm c={course === 'new' ? null : course} onDone={() => setCourse(null)} />}
      </Modal>

      {detail && sel && (
        <GroupDrawer g={sel} d={detail} manage={manage} role={role} groupOpts={groupOpts} onEdit={() => setEdit(sel)} onClose={() => router.push(path, { scroll: false })} />
      )}
    </>
  );
}

function GroupDrawer({ g, d, manage, role, groupOpts, onEdit, onClose }: { g: G; d: Detail; manage: boolean; role: Role; groupOpts: GroupOpt[]; onEdit: () => void; onClose: () => void }) {
  const [move, setMove] = useState<number | null>(null);
  const [report, setReport] = useState(false);
  const showMoney = role === 'rahbar' || role === 'admin';
  return (
    <Drawer
      open
      onClose={onClose}
      title={g.name}
      sub={
        <>
          {g.course}, {g.startTime}–{g.endTime}, {g.days.split(',').map((x) => DAY_FULL[x] ?? x).join(', ')}
        </>
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-line bg-white px-5 py-3">
        <LinkButton size="sm" href={`/davomat?guruh=${g.id}`}>
          <CalendarCheck className="h-4 w-4" /> Davomat belgilash
        </LinkButton>
        <Button size="sm" variant="secondary" onClick={() => setReport(true)}>
          <Send className="h-4 w-4" /> Ota-onaga hisobot
        </Button>
        {manage && (
          <>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Tahrirlash
            </Button>
            {g.active ? (
              <ActionButton action={() => closeGroup(g.id)} confirm="Guruh yopilsinmi? O'quvchilar guruhda qoladi, yangi dars belgilanmaydi.">
                <Archive className="h-4 w-4" /> Yopish
              </ActionButton>
            ) : (
              <ActionButton action={() => reopenGroup(g.id)}>
                <RotateCcw className="h-4 w-4" /> Qayta ochish
              </ActionButton>
            )}
          </>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="card px-3.5 py-3">
            <div className="text-xs text-fg-muted">O&apos;qituvchi</div>
            <div className="mt-1 truncate text-sm font-bold">{g.teacher ?? '—'}</div>
          </div>
          <div className="card px-3.5 py-3">
            <div className="text-xs text-fg-muted">Support</div>
            <div className="mt-1 truncate text-sm font-bold">{g.support ?? '—'}</div>
          </div>
          <div className="card px-3.5 py-3">
            <div className="text-xs text-fg-muted">Xona, boshlangan</div>
            <div className="mt-1 truncate text-sm font-bold">
              {g.room ?? '—'}, {fmtShort(g.startDate)}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-bold">O&apos;quvchilar ({d.members.length})</h3>
            {manage && (
              <Link href="/oquvchilar?yangi=1" className="text-[13px] font-bold text-brand">
                Yangi o&apos;quvchi
              </Link>
            )}
          </div>
          {d.members.length === 0 ? (
            <p className="px-4 py-4 text-sm text-fg-muted">Guruhda hali o&apos;quvchi yo&apos;q.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.members.map((m) => (
                <li key={m.enrollmentId} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={m.name} size={32} color={g.color} />
                  <Link href={`/oquvchilar?id=${m.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold hover:text-brand">{m.name}</div>
                    <div className="text-xs text-fg-muted tnum">
                      {phone(m.phone || m.parentPhone)}, davomat {m.att === null ? '—' : `${m.att}%`}
                    </div>
                  </Link>
                  {m.status === 'xavf' && <Badge tone="warn">Xavf</Badge>}
                  {showMoney && m.balance < 0 && <span className="text-xs font-bold text-bad tnum">{money(m.balance)}</span>}
                  {manage && (
                    <Button size="icon" variant="ghost" onClick={() => setMove(m.enrollmentId)} title="Boshqa guruhga o'tkazish" aria-label="Boshqa guruhga o'tkazish">
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-sm font-bold">O&apos;tilgan darslar</div>
          {d.lessons.length === 0 ? (
            <p className="px-4 py-4 text-sm text-fg-muted">Davomat belgilanganda dars mavzusi shu yerda ko&apos;rinadi.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.lessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{fmtDate(l.date)}</span>
                    <span className="block truncate text-xs text-fg-muted">{l.topic || 'Mavzu yozilmagan'}</span>
                  </span>
                  {l.teacherStatus !== 'vaqtida' && <Badge tone={l.teacherStatus === 'otilmadi' ? 'bad' : 'warn'}>{l.teacherStatus === 'otilmadi' ? "O'tilmadi" : 'Kechikdi'}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={move !== null} onClose={() => setMove(null)} title="Boshqa guruhga o'tkazish" size="sm">
        {move !== null && (
          <ActionForm action={moveStudent.bind(null, move)} onDone={() => setMove(null)} onCancel={() => setMove(null)} submitLabel="O'tkazish">
            <Field label="Yangi guruh">
              <GroupSelect groups={groupOpts.filter((x) => x.id !== g.id)} optional={false} />
            </Field>
          </ActionForm>
        )}
      </Modal>
      <Modal open={report} onClose={() => setReport(false)} title="Ota-onalarga hisobot" sub="Haftalik proyekt yuborilganini qayd eting. Oyiga kamida 4 marta." size="sm">
        <ActionForm action={async (fd) => logParentReport(g.id, String(fd.get('text') || ''))} onDone={() => setReport(false)} onCancel={() => setReport(false)} submitLabel="Yuborildi deb belgilash">
          <Field label="Nima yuborildi">
            <textarea name="text" rows={3} className="field" defaultValue="Haftalik proyekt va o'zlashtirish haqida ma'lumot yuborildi" />
          </Field>
        </ActionForm>
      </Modal>
    </Drawer>
  );
}

function GroupForm({ g, courses, teachers, onDone }: { g: G | null; courses: C[]; teachers: { id: number; name: string; role: string }[]; onDone: () => void }) {
  const days = new Set((g?.days ?? 'Du,Chor,Ju').split(','));
  return (
    <ActionForm action={saveGroup.bind(null, g?.id ?? null)} onDone={onDone} onCancel={onDone} submitLabel={g ? 'Saqlash' : 'Guruh ochish'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guruh nomi">
          <input name="name" defaultValue={g?.name} className="field" placeholder="Masalan: AI-4" required />
        </Field>
        <Field label="Yo'nalish">
          <select name="courseId" defaultValue={g?.courseId ?? ''} className="field" required>
            <option value="">Tanlang</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="O'qituvchi">
          <select name="teacherId" defaultValue={g?.teacherId ?? ''} className="field">
            <option value="">Tanlanmagan</option>
            {teachers.filter((t) => t.role !== 'support').map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Support teacher">
          <select name="supportId" defaultValue={g?.supportId ?? ''} className="field">
            <option value="">Yo&apos;q</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Dars kunlari">
        <div className="flex flex-wrap gap-1.5">
          {DAY_CODES.map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="days" value={d} defaultChecked={days.has(d)} className="peer sr-only" />
              <span className="inline-flex h-9 min-w-[52px] items-center justify-center rounded-field border border-line-strong px-2.5 text-[13px] font-bold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                {d}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Boshlanishi">
          <input type="time" name="startTime" defaultValue={g?.startTime ?? '14:00'} className="field" required />
        </Field>
        <Field label="Tugashi">
          <input type="time" name="endTime" defaultValue={g?.endTime ?? '16:00'} className="field" required />
        </Field>
        <Field label="Xona">
          <input name="room" defaultValue={g?.room ?? ''} className="field" />
        </Field>
        <Field label="Sig'imi">
          <input type="number" name="capacity" min={1} defaultValue={g?.capacity ?? 14} className="field" />
        </Field>
      </div>
      <Field label="Boshlangan sana">
        <input type="date" name="startDate" defaultValue={g?.startDate ?? ''} className="field" />
      </Field>
    </ActionForm>
  );
}

function CourseForm({ c, onDone }: { c: C | null; onDone: () => void }) {
  return (
    <ActionForm action={saveCourse.bind(null, c?.id ?? null)} onDone={onDone} onCancel={onDone}>
      <Field label="Nomi">
        <input name="name" defaultValue={c?.name} className="field" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Oylik narx">
          <MoneyInput name="monthlyPrice" defaultValue={c?.price} required />
        </Field>
        <Field label="Davomiyligi (oy)">
          <input type="number" name="durationMonths" min={1} defaultValue={c?.duration ?? 3} className="field" />
        </Field>
      </div>
      <Field label="Rang">
        <div className="flex gap-2">
          {COLORS.map((col, i) => (
            <label key={col} className="cursor-pointer">
              <input type="radio" name="color" value={col} defaultChecked={c ? c.color === col : i === 0} className="peer sr-only" />
              <span className="block h-8 w-8 rounded-lg ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink" style={{ background: col }} />
            </label>
          ))}
        </div>
      </Field>
      <Field label="Qisqa tavsif">
        <textarea name="description" defaultValue={c?.description ?? ''} rows={2} className="field" />
      </Field>
      {c && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="active" defaultChecked={c.active} className="h-4 w-4 accent-[#0E7C6B]" /> Faol (yangi guruh ochish mumkin)
        </label>
      )}
    </ActionForm>
  );
}
