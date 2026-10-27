'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, CalendarClock, Check, Play, RotateCcw, Trash2, ListChecks } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { useToast } from '@/components/toast';
import { deleteTask, saveTask, setTaskStatus } from '@/app/actions/tasks';
import { fmtShort, relative, today } from '@/lib/dates';

type T = { entityType: string | null; entityId: number | null; autoKey: string | null; id: number; title: string; description: string | null; assigneeId: number | null; assignee: string | null; creatorId: number | null; creator: string | null; dueDate: string | null; status: 'yangi' | 'jarayonda' | 'bajarildi'; priority: 'past' | 'orta' | 'yuqori'; doneAt: string | null; createdAt: string };

const COLS: { k: T['status']; l: string }[] = [
  { k: 'yangi', l: 'Yangi' },
  { k: 'jarayonda', l: 'Jarayonda' },
  { k: 'bajarildi', l: 'Bajarildi' },
];
const PR = { yuqori: { l: 'Muhim', tone: 'bad' as const }, orta: { l: "O'rta", tone: 'neutral' as const }, past: { l: 'Past', tone: 'info' as const } };

export function TasksView({ rows, staff, meId, isBoss, canAssign, openNew }: { rows: T[]; staff: { id: number; name: string }[]; meId: number; isBoss: boolean; canAssign: boolean; openNew: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [, start] = useTransition();
  const [scope, setScope] = useState<'men' | 'hamma'>(canAssign ? 'hamma' : 'men');
  const [who, setWho] = useState('');
  const [mode, setMode] = useState<'muddat' | 'holat'>('muddat');
  const [edit, setEdit] = useState<T | 'new' | null>(openNew ? 'new' : null);
  useEffect(() => setEdit(openNew ? 'new' : null), [openNew]);
  const t = today();
  const week = (() => {
    const d = new Date(t + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const DUE_COLS: { k: string; l: string; tone?: string; test: (r: T) => boolean }[] = [
    { k: 'otgan', l: "O'tib ketgan", tone: 'text-bad', test: (r) => r.status !== 'bajarildi' && !!r.dueDate && r.dueDate < t },
    { k: 'bugun', l: 'Bugun', test: (r) => r.status !== 'bajarildi' && r.dueDate === t },
    { k: 'hafta', l: 'Shu hafta', test: (r) => r.status !== 'bajarildi' && !!r.dueDate && r.dueDate > t && r.dueDate <= week },
    { k: 'keyin', l: 'Keyinroq', test: (r) => r.status !== 'bajarildi' && !!r.dueDate && r.dueDate > week },
    { k: 'muddatsiz', l: 'Muddatsiz', test: (r) => r.status !== 'bajarildi' && !r.dueDate },
    { k: 'bajarildi', l: 'Bajarildi', test: (r) => r.status === 'bajarildi' },
  ];
  const list = useMemo(() => rows.filter((r) => (scope === 'hamma' || r.assigneeId === meId) && (!who || String(r.assigneeId) === who)), [rows, scope, who, meId]);
  const close = () => (openNew ? router.push(path) : setEdit(null));
  const move = (id: number, s: T['status']) =>
    start(async () => {
      const r = await setTaskStatus(id, s);
      if (r.ok) router.refresh();
      else toast(r.error, 'err');
    });

  return (
    <>
      <PageHeader
        title="Vazifalar"
        sub="Vazifalar Telegramda emas, shu yerda beriladi va tekshiriladi"
        actions={
          <Button onClick={() => setEdit('new')}>
            <Plus className="h-4 w-4" /> Vazifa berish
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-field border border-line bg-white p-1">
          {(['muddat', 'holat'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', mode === m ? 'bg-ink text-white' : 'text-fg-muted')}>
              {m === 'muddat' ? "Muddat bo'yicha" : "Holat bo'yicha"}
            </button>
          ))}
        </div>
      {canAssign && (
        <>
          <div className="inline-flex rounded-field border border-line bg-white p-1">
            {(['hamma', 'men'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', scope === s ? 'bg-ink text-white' : 'text-fg-muted')}>
                {s === 'hamma' ? 'Barcha vazifalar' : 'Mening vazifalarim'}
              </button>
            ))}
          </div>
          {scope === 'hamma' && (
            <select value={who} onChange={(e) => setWho(e.target.value)} className="field h-9 w-52" aria-label="Xodim">
              <option value="">Barcha xodimlar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      </div>
      {rows.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks className="h-5 w-5" />} title="Hali vazifa yo'q" text="Har dushanba haftaning 3 ta asosiy vazifasini shu yerga qo'ying." action={<Button onClick={() => setEdit('new')}>Vazifa berish</Button>} />
        </Card>
      ) : (
        <div className={cn('grid gap-4', mode === 'holat' ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-3')}>
          {(mode === 'holat' ? COLS.map((c) => ({ k: c.k as string, l: c.l, tone: undefined as string | undefined, test: (r: T) => r.status === c.k })) : DUE_COLS).map((c) => {
            const items = list.filter(c.test).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
            return (
              <section key={c.k} className="rounded-card border border-line bg-white/60">
                <header className="flex items-center justify-between px-4 py-3">
                  <h2 className={cn('text-sm font-extrabold', c.tone)}>{c.l}</h2>
                  <span className="text-xs font-bold text-fg-muted tnum">{items.length}</span>
                </header>
                <div className="space-y-2 px-2 pb-2">
                  {items.length === 0 && <div className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-fg-faint">Bo&apos;sh</div>}
                  {items.map((r) => {
                    const late = r.status !== 'bajarildi' && r.dueDate && r.dueDate < t;
                    return (
                      <article key={r.id} className={cn('rounded-xl border bg-white p-3.5', late ? 'border-bad/40' : 'border-line')}>
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => setEdit(r)} className={cn('text-left text-sm font-bold hover:text-brand', r.status === 'bajarildi' && 'text-fg-muted line-through')}>
                            {r.title}
                          </button>
                          {r.priority !== 'orta' && <Badge tone={PR[r.priority].tone}>{PR[r.priority].l}</Badge>}
                        </div>
                        {r.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-fg-muted">{r.description}</p>}
                        {r.entityType && r.entityId && (
                          <Link href={r.entityType === 'lead' ? `/lidlar?id=${r.entityId}` : r.entityType === 'group' ? `/guruhlar?id=${r.entityId}` : `/oquvchilar?id=${r.entityId}`} className="mt-1.5 inline-block text-xs font-bold text-brand hover:underline">
                            Ochish
                          </Link>
                        )}
                        {r.autoKey && <Badge tone="info" className="ml-2">Avtomatik</Badge>}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                          <span className="font-semibold text-fg">{r.assignee ?? '—'}</span>
                          {r.dueDate && (
                            <span className={cn('inline-flex items-center gap-1', late && 'font-bold text-bad')}>
                              <CalendarClock className="h-3 w-3" /> {fmtShort(r.dueDate)}
                            </span>
                          )}
                          {r.creator && r.creatorId !== r.assigneeId && <span>bergan: {r.creator}</span>}
                          {r.doneAt && <span>{relative(r.doneAt)}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {r.status === 'yangi' && (
                            <Button size="sm" variant="secondary" onClick={() => move(r.id, 'jarayonda')}>
                              <Play className="h-3.5 w-3.5" /> Boshlash
                            </Button>
                          )}
                          {r.status !== 'bajarildi' ? (
                            <Button size="sm" variant="soft" onClick={() => move(r.id, 'bajarildi')}>
                              <Check className="h-3.5 w-3.5" /> Bajarildi
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => move(r.id, 'jarayonda')}>
                              <RotateCcw className="h-3.5 w-3.5" /> Qaytarish
                            </Button>
                          )}
                          {(isBoss || r.creatorId === meId) && (
                            <ActionButton variant="ghost" size="sm" className="ml-auto" action={() => deleteTask(r.id)} confirm="Vazifa o'chirilsinmi?" title="O'chirish">
                              <Trash2 className="h-3.5 w-3.5" />
                            </ActionButton>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Modal open={!!edit} onClose={close} title={edit === 'new' ? 'Yangi vazifa' : 'Vazifani tahrirlash'}>
        {edit && (
          <ActionForm action={saveTask.bind(null, edit === 'new' ? null : edit.id)} onDone={close} onCancel={close} submitLabel={edit === 'new' ? 'Vazifa berish' : 'Saqlash'}>
            <Field label="Vazifa">
              <input name="title" defaultValue={edit === 'new' ? '' : edit.title} className="field" placeholder="Masalan: Oktabr qarzdorlari bilan uchrashish" required />
            </Field>
            <Field label="Tafsilot">
              <textarea name="description" defaultValue={edit === 'new' ? '' : edit.description ?? ''} rows={3} className="field" placeholder="Natija qanday bo'lishi kerak" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Kimga">
                <select name="assigneeId" defaultValue={edit === 'new' ? meId : edit.assigneeId ?? meId} className="field" disabled={!canAssign}>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Muddat">
                <input type="date" name="dueDate" defaultValue={edit === 'new' ? '' : edit.dueDate ?? ''} className="field" />
              </Field>
              <Field label="Muhimlik">
                <select name="priority" defaultValue={edit === 'new' ? 'orta' : edit.priority} className="field">
                  <option value="yuqori">Muhim</option>
                  <option value="orta">O&apos;rta</option>
                  <option value="past">Past</option>
                </select>
              </Field>
            </div>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
