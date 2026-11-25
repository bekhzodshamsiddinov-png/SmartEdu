'use client';
import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, FileSpreadsheet, Layers, Magnet, Upload, X } from 'lucide-react';
import { Badge, Button, Card, Field, PageHeader, cn } from '@/components/ui';
import { useToast } from '@/components/toast';
import { importLeads, importStudents } from '@/app/actions/import';
import { CALL_STATUSES, LEAD_SOURCES, LEAD_STAGES, SOURCE_COLOR } from '@/lib/constants';
import { DAY_CODES } from '@/lib/dates';
import { parseSheet, daysCode, timeRange, guessLead, shortNote, type ParsedSheet, type ParsedRow, type Cell } from '@/lib/import-parse';
import { phone as fmtPhone } from '@/lib/format';
import type { GroupOpt } from '@/components/forms';

type Opt = { id: number; name: string };
type Course = { id: number; name: string; color: string | null; price: number };
type Kind = 'lead' | 'student' | 'skip';

const DAY_LABEL: Record<string, string> = { Du: 'Du', Se: 'Se', Chor: 'Chor', Pa: 'Pa', Ju: 'Ju', Sha: 'Sha', Ya: 'Ya' };

/** Yo'nalish nomidan kursni topish: "AI" → Sun'iy intellekt, "Frontend"/"Dasturlash" → dasturlash, "Savodxonlik" → kompyuter savodxonligi */
function matchCourse(direction: string | null, courses: Course[]) {
  const d = (direction ?? '').toLowerCase();
  if (!d) return null;
  const test = (re: RegExp) => courses.find((c) => re.test(c.name.toLowerCase()))?.id ?? null;
  if (/savod/.test(d)) return test(/savod/);
  if (/\bai\b|sun'?iy|intellekt/.test(d)) return test(/sun.?iy|intellekt/) ?? test(/^ai\b|\(ai\)/) ?? test(/\bai\b/);
  if (/dastur|frontend|front|web|fullstack|python/.test(d)) return test(/frontend|dastur|web|fullstack/);
  return courses.find((c) => c.name.toLowerCase().includes(d))?.id ?? null;
}

function mostCommon<T>(xs: (T | null)[]) {
  const m = new Map<string, { v: T; n: number }>();
  for (const x of xs) {
    if (x === null) continue;
    const k = JSON.stringify(x);
    m.set(k, { v: x, n: (m.get(k)?.n ?? 0) + 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n)[0]?.v ?? null;
}

export function ImportView({ courses, groups, teachers, sellers, today }: { courses: Course[]; groups: GroupOpt[]; teachers: Opt[]; sellers: Opt[]; today: string }) {
  const toast = useToast();
  const [file, setFile] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [busy, setBusy] = useState(false);

  async function load(f: File | undefined) {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return toast("Faqat .xlsx (Excel) fayl yuklanadi.", 'err');
    if (f.size > 8 * 1024 * 1024) return toast('Fayl 8 MB dan katta.', 'err');
    setBusy(true);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const all = (await readXlsxFile(f)) as { sheet: string; data: Cell[][] }[];
      const parsed = all.map((s) => parseSheet(s.sheet, s.data)).filter((s): s is ParsedSheet => !!s && s.rows.length > 0);
      if (!parsed.length) toast("Faylda o'quvchi yoki lid ro'yxati topilmadi. Birinchi qatorda «O'quvchi» yoki «Ism» ustuni bo'lsin.", 'err');
      setSheets(parsed);
      setFile(f.name);
    } catch {
      toast("Faylni o'qib bo'lmadi. U Excel (.xlsx) ekanini tekshiring.", 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Excel'dan yuklash"
        sub="Lidlar ro'yxatini «Lidlar»ga, o'qiyotgan o'quvchilarni guruhga bir martada o'tkazing"
      />
      {!sheets.length ? (
        <Card className="p-6">
          <label
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line-strong px-6 py-14 text-center hover:bg-canvas', busy && 'opacity-60')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              load(e.dataTransfer.files?.[0]);
            }}
          >
            <FileSpreadsheet className="h-10 w-10 text-brand" />
            <span className="text-base font-bold">{busy ? "O'qilmoqda..." : 'Excel faylni tanlang yoki shu yerga tashlang'}</span>
            <span className="max-w-md text-sm text-fg-muted">
              Har bir varaq alohida ko&apos;rsatiladi. Ustunlar sarlavhasidan aniqlanadi: o&apos;quvchi, yo&apos;nalish, kunlar, vaqt, telefon, otasi, onasi, izoh va boshqalar.
              Fayl brauzeringizda o&apos;qiladi, serverga faqat siz tasdiqlagan qatorlar yuboriladi.
            </span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => load(e.target.files?.[0])} disabled={busy} />
          </label>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block truncate font-bold">{file}</span>
                <span className="block text-xs text-fg-muted">{sheets.length} ta varaq, {sheets.reduce((a, s) => a + s.rows.length, 0)} ta qator</span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => (setSheets([]), setFile(null))}>
              <X className="h-4 w-4" /> Boshqa fayl
            </Button>
          </div>
          <div className="space-y-5">
            {sheets.map((s) => (
              <SheetCard key={s.name} sheet={s} courses={courses} groups={groups} teachers={teachers} sellers={sellers} today={today} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function SheetCard({ sheet, courses, groups, teachers, sellers, today }: { sheet: ParsedSheet; courses: Course[]; groups: GroupOpt[]; teachers: Opt[]; sellers: Opt[]; today: string }) {
  const [kind, setKind] = useState<Kind>(sheet.kind);
  const [split, setSplit] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const subGroups = useMemo(() => [...new Set(sheet.rows.map((r) => r.group).filter(Boolean))] as string[], [sheet]);

  return (
    <Card className={cn('overflow-hidden', done && 'border-good/40')}>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-extrabold">{sheet.name}</h2>
            <Badge>{sheet.rows.length} ta</Badge>
            {done && (
              <Badge tone="good">
                <CheckCircle2 className="h-3 w-3" /> yuklandi
              </Badge>
            )}
          </div>
          {done && <p className="mt-1 text-sm text-good">{done}</p>}
        </div>
        {!done && (
          <div className="grid shrink-0 grid-cols-3 rounded-field border border-line bg-white p-1 sm:inline-flex" role="radiogroup" aria-label="Nima qilish kerak">
            {(
              [
                ['lead', 'Lidlarga', Magnet],
                ['student', 'Guruhga', Layers],
                ['skip', "Kerak emas", X],
              ] as const
            ).map(([k, l, I]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-bold', kind === k ? 'bg-ink text-white' : 'text-fg-muted hover:text-fg')}
              >
                <I className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>
        )}
      </div>
      {done ? null : kind === 'lead' ? (
        <LeadImport sheet={sheet} courses={courses} sellers={sellers} onDone={setDone} />
      ) : kind === 'student' ? (
        <>
          {subGroups.length > 1 && (
            <label className="flex items-start gap-2 border-b border-line bg-warn-soft/40 px-4 py-3 text-sm sm:px-5">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0E7C6B]" />
              <span>
                Bu varaqda {subGroups.length} ta guruh bor ({subGroups.join(', ')}). <b>Har biriga alohida guruh ochish</b>
                <span className="block text-xs text-fg-muted">Belgilanmasa, hammasi bitta guruhga qo&apos;shiladi.</span>
              </span>
            </label>
          )}
          {split && subGroups.length > 1 ? (
            subGroups.map((g) => (
              <StudentImport
                key={g}
                sheet={{ ...sheet, name: `${sheet.name} ${g}`, rows: sheet.rows.filter((r) => r.group === g) }}
                defaultName={g}
                courses={courses}
                groups={groups}
                teachers={teachers}
                today={today}
                onDone={(m) => setDone((d) => (d ? `${d}. ${m}` : m))}
              />
            ))
          ) : (
            <StudentImport sheet={sheet} defaultName={sheet.name} courses={courses} groups={groups} teachers={teachers} today={today} onDone={setDone} />
          )}
        </>
      ) : (
        <p className="px-5 py-4 text-sm text-fg-muted">Bu varaq yuklanmaydi.</p>
      )}
    </Card>
  );
}

function useSelection(rows: ParsedRow[], ok: (r: ParsedRow) => boolean) {
  const [off, setOff] = useState<Set<number>>(() => new Set(rows.filter((r) => !ok(r)).map((r) => r.line)));
  const toggle = (line: number) =>
    setOff((s) => {
      const n = new Set(s);
      if (n.has(line)) n.delete(line);
      else n.add(line);
      return n;
    });
  return { picked: rows.filter((r) => !off.has(r.line)), isOn: (r: ParsedRow) => !off.has(r.line), toggle };
}

function LeadImport({ sheet, courses, sellers, onDone }: { sheet: ParsedSheet; courses: Course[]; sellers: Opt[]; onDone: (m: string) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [source, setSource] = useState("Eski o'quvchi");
  const [seller, setSeller] = useState('');
  const directions = useMemo(() => [...new Set(sheet.rows.map((r) => r.direction ?? ''))], [sheet]);
  const [map, setMap] = useState<Record<string, number | null>>(() => Object.fromEntries(directions.map((d) => [d, matchCourse(d, courses)])));
  const sel = useSelection(sheet.rows, (r) => !!r.phone);

  function submit() {
    const payload = JSON.stringify({ sheet: sheet.name, source, assignedToId: seller ? Number(seller) : null, courses: map, rows: sel.picked });
    start(async () => {
      const r = await importLeads(payload);
      if (r.ok) {
        toast(r.message ?? 'Yuklandi');
        onDone(r.message ?? '');
      } else toast(r.error, 'err');
    });
  }

  return (
    <div>
      <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <Field label="Manba (qayerdan)">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="field">
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {directions.map((d) => (
          <Field key={d} label={d ? `«${d}» → yo'nalish` : "Yo'nalish"}>
            <select value={map[d] ?? ''} onChange={(e) => setMap((m) => ({ ...m, [d]: e.target.value ? Number(e.target.value) : null }))} className="field">
              <option value="">— tanlanmagan —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label="Sotuvchiga biriktirish">
          <select value={seller} onChange={(e) => setSeller(e.target.value)} className="field">
            <option value="">— biriktirilmaydi —</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <RowsTable
        rows={sheet.rows}
        sel={sel}
        cols={[
          { h: 'Holat', c: (r) => <LeadBadge r={r} /> },
          { h: 'Izoh (lid kartasiga)', c: (r) => <span className="line-clamp-2 text-fg-muted">{shortNote(r) || '—'}</span> },
        ]}
      />
      <Footer
        count={sel.picked.length}
        note={
          <>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SOURCE_COLOR[source] ?? '#8C9A97' }} /> {source}. Bosqich izohdan aniqlanadi; to&apos;liq ma&apos;lumot (ota-ona, o&apos;tilgan mavzular) lid tarixiga yoziladi. Qayta yuklansa ikki marta tushmaydi.
          </>
        }
        label={`${sel.picked.length} ta lidni yuklash`}
        pending={pending}
        onClick={submit}
      />
    </div>
  );
}

function LeadBadge({ r }: { r: ParsedRow }) {
  const g = guessLead(r.comment);
  const st = LEAD_STAGES.find((x) => x.key === g.stage)!;
  const cs = CALL_STATUSES.find((x) => x.key === g.callStatus);
  return (
    <div className="flex flex-wrap gap-1">
      <Badge tone={st.tone}>{st.label}</Badge>
      {cs && <Badge tone={cs.tone}>{cs.label}</Badge>}
    </div>
  );
}

function StudentImport({
  sheet, defaultName, courses, groups, teachers, today, onDone,
}: { sheet: ParsedSheet; defaultName: string; courses: Course[]; groups: GroupOpt[]; teachers: Opt[]; today: string; onDone: (m: string) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string>('new');
  const [name, setName] = useState(defaultName.trim());
  const [courseId, setCourseId] = useState<number | ''>(() => matchCourse(mostCommon(sheet.rows.map((r) => r.direction)), courses) ?? '');
  const [teacher, setTeacher] = useState('');
  const [days, setDays] = useState<string[]>(() => (mostCommon(sheet.rows.map((r) => daysCode(r.days))) ?? 'Du,Chor,Ju').split(','));
  const tr = mostCommon(sheet.rows.map((r) => timeRange(r.time)));
  const [st, setSt] = useState(tr?.[0] ?? '14:00');
  const [et, setEt] = useState(tr?.[1] ?? '16:00');
  const [startDate, setStartDate] = useState(today);
  const [skipFirst, setSkipFirst] = useState(true);
  const sel = useSelection(sheet.rows, () => true);
  const course = courses.find((c) => c.id === courseId);
  const mixed = new Set(sheet.rows.map((r) => `${daysCode(r.days)} ${r.time}`)).size > 1;

  function submit() {
    const payload = JSON.stringify({
      sheet: sheet.name,
      startDate,
      skipFirstMonth: skipFirst,
      groupId: target === 'new' ? null : Number(target),
      newGroup: target === 'new' ? { name, courseId: courseId || null, teacherId: teacher ? Number(teacher) : null, days, startTime: st, endTime: et } : null,
      rows: sel.picked,
    });
    start(async () => {
      const r = await importStudents(payload);
      if (r.ok) {
        toast(r.message ?? 'Yuklandi');
        onDone(r.message ?? '');
      } else toast(r.error, 'err');
    });
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <Field label="Guruh">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="field">
            <option value="new">+ Yangi guruh ochish</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.course}
              </option>
            ))}
          </select>
        </Field>
        {target === 'new' && (
          <>
            <Field label="Guruh nomi">
              <input value={name} onChange={(e) => setName(e.target.value)} className="field" maxLength={60} />
            </Field>
            <Field label="Yo'nalish">
              <select value={courseId} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : '')} className="field">
                <option value="">— tanlang —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="O'qituvchi">
              <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="field">
                <option value="">— keyin tanlanadi —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dars kunlari" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {DAY_CODES.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))}
                      className={cn('h-9 min-w-11 rounded-field border px-2.5 text-sm font-bold', on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white text-fg-muted')}
                    >
                      {DAY_LABEL[d]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Dars vaqti">
              <div className="flex items-center gap-2">
                <input type="time" value={st} onChange={(e) => setSt(e.target.value)} className="field" />
                <span className="text-fg-muted">—</span>
                <input type="time" value={et} onChange={(e) => setEt(e.target.value)} className="field" />
              </div>
            </Field>
          </>
        )}
        <Field label="Guruhga qo'shilish sanasi" hint="Shu sanadan oylik hisoblanadi">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" />
        </Field>
      </div>
      <label className="flex items-start gap-2 border-b border-line px-4 py-3 text-sm sm:px-5">
        <input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0E7C6B]" />
        <span>
          <b>{startDate.slice(0, 7) === today.slice(0, 7) ? 'Shu oy' : 'Birinchi oy'} uchun qarz yozilmasin</b>
          <span className="block text-xs text-fg-muted">O&apos;quvchilar allaqachon o&apos;qiyotgan va bu oy to&apos;lovi eski tartibda olingan bo&apos;lsa belgilang. Keyingi oydan oylik avtomatik yoziladi.</span>
        </span>
      </label>
      {mixed && target === 'new' && (
        <p className="border-b border-line bg-warn-soft/40 px-4 py-2.5 text-[13px] sm:px-5">
          Ro&apos;yxatda har xil dars vaqtlari bor. Guruh eng ko&apos;p uchragan vaqt bilan ochiladi, har bir o&apos;quvchining vaqti uning izohiga yoziladi.
        </p>
      )}
      <RowsTable
        rows={sheet.rows}
        sel={sel}
        cols={[
          { h: 'Ota-ona', c: (r) => <span className="text-fg-muted">{[r.motherName ?? r.fatherName, (r.motherPhone ?? r.fatherPhone) && fmtPhone(r.motherPhone ?? r.fatherPhone!)].filter(Boolean).join(', ') || '—'}</span> },
          { h: 'Boshlagan', c: (r) => <span className="tnum text-fg-muted">{r.startDate ?? '—'}</span> },
          { h: 'Izoh', c: (r) => <span className="line-clamp-2 text-fg-muted">{shortNote(r) || '—'}</span> },
        ]}
      />
      <Footer
        count={sel.picked.length}
        note={
          <>
            {course ? `Oylik to'lov: kurs narxi (${course.price.toLocaleString('ru-RU').replace(/,/g, ' ')} so'm). ` : ''}
            Bazada bor o&apos;quvchi (bir xil ism va raqam) qayta ochilmaydi, faqat guruhga qo&apos;shiladi. Ota-ona ma&apos;lumoti va o&apos;tilgan mavzular o&apos;quvchi kartasiga yoziladi.
          </>
        }
        label={target === 'new' ? `Guruh ochib, ${sel.picked.length} ta o'quvchini qo'shish` : `${sel.picked.length} ta o'quvchini guruhga qo'shish`}
        pending={pending}
        onClick={submit}
      />
    </div>
  );
}

function RowsTable({ rows, sel, cols }: { rows: ParsedRow[]; sel: ReturnType<typeof useSelection>; cols: { h: string; c: (r: ParsedRow) => React.ReactNode }[] }) {
  return (
    <div className="max-h-[460px] overflow-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 z-10 bg-canvas text-left text-xs font-bold uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="w-10 px-4 py-2.5 sm:px-5" />
            <th className="px-2 py-2.5">O&apos;quvchi</th>
            <th className="px-2 py-2.5">Telefon</th>
            {cols.map((c) => (
              <th key={c.h} className="px-2 py-2.5">
                {c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const on = sel.isOn(r);
            return (
              <tr key={r.line} className={cn('align-top', !on && 'opacity-45')}>
                <td className="px-4 py-2.5 sm:px-5">
                  <input type="checkbox" checked={on} onChange={() => sel.toggle(r.line)} className="h-4 w-4 accent-[#0E7C6B]" aria-label={`${r.name} tanlash`} />
                </td>
                <td className="px-2 py-2.5 font-semibold">
                  {r.name}
                  {r.direction && <span className="block text-xs font-normal text-fg-muted">{r.direction}{r.group ? `, ${r.group}` : ''}</span>}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tnum">{r.phone ? fmtPhone(r.phone) : <span className="text-bad">raqam yo&apos;q</span>}</td>
                {cols.map((c) => (
                  <td key={c.h} className="max-w-[340px] px-2 py-2.5">
                    {c.c(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Footer({ count, note, label, pending, onClick }: { count: number; note: React.ReactNode; label: string; pending: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line bg-canvas/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-[13px] text-fg-muted">{note}</p>
      <Button onClick={onClick} disabled={pending || !count} className="shrink-0">
        <Upload className="h-4 w-4" /> {pending ? 'Yuklanmoqda...' : label}
      </Button>
    </div>
  );
}

