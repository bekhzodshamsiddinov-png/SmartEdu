'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ChevronDown, Gauge } from 'lucide-react';
import type { Role } from '@/db/schema';
import { Avatar, Badge, Button, Card, Empty, PageHeader, cn } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/roles';
import { addDays, fmtDate, WEEKDAYS, WEEKDAYS_FULL, weekday } from '@/lib/dates';

type Item = { key: string; label: string; done: number; total: number; href?: string; hint?: string };
type S = { id: number; fullName: string; role: Role; items: Item[]; score: number | null; week: (number | null)[] };

function tone(v: number | null) {
  if (v === null) return { bar: 'bg-line', text: 'text-fg-faint', label: '—' };
  if (v >= 90) return { bar: 'bg-good', text: 'text-good', label: `${v}%` };
  if (v >= 60) return { bar: 'bg-warn', text: 'text-warn', label: `${v}%` };
  return { bar: 'bg-bad', text: 'text-bad', label: `${v}%` };
}

export function ControlView({ date, todayStr, days, staff }: { date: string; todayStr: string; days: string[]; staff: S[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const scored = staff.filter((s) => s.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length) : null;
  const weekAvg = (() => {
    const all = staff.flatMap((s) => s.week.filter((v): v is number => v !== null));
    return all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null;
  })();
  const sorted = [...staff].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  const missed = staff.reduce((a, s) => a + s.items.filter((i) => i.total > 0 && i.done < i.total).length, 0);
  const go = (d: string) => router.push(`/nazorat?sana=${d}`, { scroll: false });

  return (
    <>
      <PageHeader
        title="Nazorat"
        sub="Har bir xodim o'z ishini bajardimi. Tizimdagi yozuvlar asosida avtomatik hisoblanadi."
        actions={
          <div className="card flex items-center">
            <Button size="icon" variant="ghost" onClick={() => go(addDays(date, -1))} aria-label="Oldingi kun">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <label className="relative min-w-[150px] text-center">
              <div className="text-[13px] font-bold">{date === todayStr ? 'Bugun' : WEEKDAYS_FULL[weekday(date)]}</div>
              <div className="text-xs text-fg-muted">{fmtDate(date)}</div>
              <input type="date" max={todayStr} value={date} onChange={(e) => e.target.value && go(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Sana" />
            </label>
            <Button size="icon" variant="ghost" onClick={() => go(addDays(date, 1))} disabled={date >= todayStr} aria-label="Keyingi kun">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Summary label="Jamoa bajarilishi" value={avg} />
        <Summary label="7 kunlik o'rtacha" value={weekAvg} />
        <div className="card px-5 py-4">
          <div className="text-[13px] font-medium text-fg-muted">Bajarilmagan ishlar</div>
          <div className={cn('mt-1.5 text-[26px] font-extrabold leading-none tnum', missed ? 'text-bad' : 'text-good')}>{missed}</div>
        </div>
      </div>

      {staff.length === 0 ? (
        <Card>
          <Empty icon={<Gauge className="h-5 w-5" />} title="Xodim qo'shilmagan" text="Xodimlar bo'limida jamoangizni qo'shing, ularning ishi shu yerda kuzatiladi." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_250px_32px] items-center gap-4 border-b border-line bg-canvas/60 px-5 py-2.5 text-xs font-semibold text-fg-muted md:grid">
            <span>Xodim</span>
            <span>Bugun</span>
            <span>Oxirgi 7 kun</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {sorted.map((s) => {
              const t = tone(s.score);
              const misses = s.items.filter((i) => i.total > 0 && i.done < i.total);
              const isOpen = open === s.id;
              return (
                <li key={s.id}>
                  <button onClick={() => setOpen(isOpen ? null : s.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 text-left hover:bg-canvas/60 md:grid-cols-[minmax(0,1fr)_120px_250px_32px]" aria-expanded={isOpen}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={s.fullName} size={36} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{s.fullName}</div>
                        <div className="truncate text-xs text-fg-muted">
                          {ROLE_LABELS[s.role]}
                          {misses.length > 0 && <span className="text-bad">, {misses.length} ta ish qolgan</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={cn('w-11 text-right text-[15px] font-extrabold tnum', t.text)}>{t.label}</span>
                      <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-canvas md:block">
                        <div className={cn('h-full rounded-full', t.bar)} style={{ width: `${s.score ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="hidden items-end gap-1.5 md:flex" aria-label="Oxirgi 7 kun">
                      {s.week.map((v, i) => {
                        const tt = tone(v);
                        return (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${fmtDate(days[i])}: ${tt.label}`}>
                            <div className="flex h-8 w-full items-end rounded bg-canvas">
                              <div className={cn('w-full rounded', tt.bar)} style={{ height: `${v === null ? 8 : Math.max(8, v)}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-fg-faint">{WEEKDAYS[weekday(days[i])]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <ChevronDown className={cn('hidden h-4 w-4 text-fg-faint transition-transform md:block', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <ul className="grid gap-2 bg-canvas/50 px-5 pb-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                      {s.items.map((it) => {
                        const ok = it.total === 0 || it.done >= it.total;
                        const body = (
                          <>
                            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold">{it.label}</span>
                              <span className="text-xs text-fg-muted tnum">
                                {it.total === 0 ? 'Bu kun talab qilinmagan' : `${it.done} / ${it.total}`}
                                {it.hint && `, ${it.hint}`}
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <li key={it.key}>
                            {it.href ? (
                              <Link href={it.href} className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 hover:border-line-strong">
                                {body}
                              </Link>
                            ) : (
                              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="mt-4 text-xs text-fg-muted">
        Foiz har bir ish bo&apos;yicha bajarilgan ulushning o&apos;rtachasi. 90% va undan yuqori <Badge tone="good">yaxshi</Badge>, 60–89% <Badge tone="warn">e&apos;tibor</Badge>, 60% dan past <Badge tone="bad">muammo</Badge>.
      </p>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number | null }) {
  const t = tone(value);
  return (
    <div className="card px-5 py-4">
      <div className="text-[13px] font-medium text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 text-[26px] font-extrabold leading-none tnum', t.text)}>{t.label}</div>
    </div>
  );
}
