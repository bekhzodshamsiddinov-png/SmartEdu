'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Globe, Medal, Plus, Search, Trophy } from 'lucide-react';
import { Badge, Button, Card, Empty, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ResultForm, levelLabel, placeLabel } from '@/components/results';
import { ActionButton } from '@/components/action-form';
import { searchStudentsForResult, toggleResultPublic } from '@/app/actions/results';
import { RESULT_META } from '@/lib/constants';
import { money } from '@/lib/format';
import { fmtDate } from '@/lib/dates';

type R = {
  id: number; type: string; title: string; amount: number | null; date: string; note: string | null; place: string | null; level: string | null; link: string | null; isPublic: boolean;
  student_id: number; name: string; status: string; course: string | null; color: string | null;
};

const INCOME = ['Loyiha sotdi', 'Birinchi zakaz', 'YouTube daromad', 'Grant'];
const COMPETE = ['Musobaqa', 'Olimpiada', 'Tanlov'];

export function AchievementsView({ rows, year, years, canAdd, canEdit }: { rows: R[]; year: string; years: string[]; canAdd: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const stats = useMemo(() => {
    const prizes = rows.filter((r) => COMPETE.includes(r.type) && ['1', '2', '3'].includes(r.place ?? '')).length;
    const apps = rows.filter((r) => r.type === 'Play Market ilova').length;
    const income = rows.filter((r) => INCOME.includes(r.type)).reduce((a, r) => a + (r.amount ?? 0), 0);
    const jobs = rows.filter((r) => r.type === 'Ishga kirdi');
    const people = new Set(rows.map((r) => r.student_id)).size;
    return { prizes, apps, income, jobs: jobs.length, people };
  }, [rows]);
  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.type, (m.get(r.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const list = rows.filter((r) => (!type || r.type === type) && (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader
        title="Yutuqlar"
        sub="O'quvchi va bitiruvchilarning natijalari — markazning eng kuchli reklamasi"
        actions={
          <>
            <a href="/akademiya/yutuqlar" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-field border border-line-strong bg-white px-4 text-sm font-bold hover:bg-canvas">
              <Globe className="h-4 w-4" /> Saytdagi sahifa
            </a>
            {canAdd && (
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Yutuq qo&apos;shish
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Yutuqlar" value={String(rows.length)} hint={`${stats.people} kishi`} />
        <Stat label="Sovrinli o'rin" value={String(stats.prizes)} hint="musobaqa, olimpiada" tone="good" />
        <Stat label="Play Market ilovalar" value={String(stats.apps)} />
        <Stat label="O'quvchilar daromadi" value={stats.income ? money(stats.income, false) : '—'} hint="loyiha, zakaz, YouTube, grant" />
        <Stat label="Ishga kirdi" value={String(stats.jobs)} />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki yutuq bo'yicha" className="field pl-9" aria-label="Qidirish" />
            </div>
            <select value={year} onChange={(e) => router.push(`/yutuqlar${e.target.value === 'hammasi' ? '' : `?yil=${e.target.value}`}`)} className="field sm:w-40" aria-label="Yil">
              <option value="hammasi">Barcha yillar</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!type} onClick={() => setType('')}>
              Hammasi <span className="opacity-60">{rows.length}</span>
            </Chip>
            {types.map(([t, n]) => (
              <Chip key={t} on={type === t} onClick={() => setType(type === t ? '' : t)}>
                <span className="h-2 w-2 rounded-full" style={{ background: RESULT_META[t]?.color ?? '#8C9A97' }} /> {t} <span className="opacity-60">{n}</span>
              </Chip>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty icon={<Trophy className="h-5 w-5" />} title={rows.length ? 'Topilmadi' : "Hali yutuq yozilmagan"} text={rows.length ? undefined : "O'quvchi musobaqada qatnashsa, Play Market'ga ilova qo'ysa, loyiha sotsa yoki YouTube'dan daromad qilsa — shu yerga yozing."} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: RESULT_META[r.type]?.color ?? '#8C9A97' }}>
                  <Medal className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">{r.title}</span>
                    {placeLabel(r.place) && <Badge tone={r.place === '1' ? 'good' : 'brand'}>{placeLabel(r.place)}</Badge>}
                    {levelLabel(r.level) && <Badge>{levelLabel(r.level)}</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-fg-muted">
                    <Link href={r.status === 'bitirgan' ? '/bitiruvchilar' : `/oquvchilar?id=${r.student_id}`} className="font-semibold text-fg hover:text-brand">
                      {r.name}
                    </Link>
                    {r.status === 'bitirgan' && <Badge tone="brand">bitiruvchi</Badge>}
                    {r.course && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm" style={{ background: r.color ?? '#8C9A97' }} /> {r.course}
                      </span>
                    )}
                    <span>
                      {r.type}, {fmtDate(r.date)}
                      {r.amount ? `, ${money(r.amount)}` : ''}
                    </span>
                  </div>
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      <ExternalLink className="h-3 w-3" /> Isbot
                    </a>
                  )}
                </div>
                {canEdit && (
                  <ActionButton size="icon" variant="ghost" action={() => toggleResultPublic(r.id)} title={r.isPublic ? 'Saytdan olish' : "Saytda ko'rsatish"}>
                    <Globe className={cn('h-4 w-4', r.isPublic ? 'text-good' : 'text-fg-faint')} />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={adding} onClose={() => setAdding(false)} title="Yutuq qo'shish" size="sm">
        {adding && <AddFlow onDone={() => setAdding(false)} />}
      </Modal>
    </>
  );
}

function AddFlow({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<{ id: number; name: string; status: string }[]>([]);
  const [st, setSt] = useState<{ id: number; name: string } | null>(null);
  if (st)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-field bg-canvas px-3 py-2 text-sm">
          <b>{st.name}</b>
          <button type="button" onClick={() => setSt(null)} className="text-xs font-bold text-brand">
            O&apos;zgartirish
          </button>
        </div>
        <ResultForm studentId={st.id} onDone={onDone} />
      </div>
    );
  return (
    <div>
      <label className="label" htmlFor="ach-student">
        Kimning yutug&apos;i
      </label>
      <input
        id="ach-student"
        autoFocus
        value={q}
        onChange={async (e) => {
          const v = e.target.value;
          setQ(v);
          setOpts(v.trim().length >= 2 ? await searchStudentsForResult(v) : []);
        }}
        placeholder="O'quvchi yoki bitiruvchi ismi"
        className="field"
        autoComplete="off"
      />
      <ul className="mt-2 divide-y divide-line rounded-field border border-line">
        {opts.length === 0 && <li className="px-3 py-2.5 text-sm text-fg-muted">{q.trim().length >= 2 ? 'Topilmadi' : 'Kamida 2 harf yozing'}</li>}
        {opts.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => setSt(o)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-canvas">
              {o.name}
              <span className="text-xs text-fg-muted">{o.status === 'bitirgan' ? 'bitiruvchi' : "o'quvchi"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted hover:text-fg')}>
      {children}
    </button>
  );
}
