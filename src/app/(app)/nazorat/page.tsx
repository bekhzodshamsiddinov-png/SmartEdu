import { requireSection } from '@/lib/auth';
import { complianceForDay } from '@/lib/compliance';
import { addDays, today } from '@/lib/dates';
import { ControlView } from './view';

export const metadata = { title: 'Nazorat' };

export default async function ControlPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireSection('control');
  const t = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.sana ?? '') && sp.sana <= t ? sp.sana : t;
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const results = await Promise.all(days.map((d) => complianceForDay(d)));
  const current = results[6];
  const week = new Map<number, (number | null)[]>();
  results.forEach((r, i) => r.staff.forEach((s) => {
    const arr = week.get(s.id) ?? Array(7).fill(null);
    arr[i] = s.score;
    week.set(s.id, arr);
  }));
  return (
    <ControlView
      date={date}
      todayStr={t}
      days={days}
      staff={current.staff.map((s) => ({ ...s, week: week.get(s.id) ?? [] }))}
    />
  );
}
