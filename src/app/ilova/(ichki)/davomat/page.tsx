import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { currentChild } from '@/lib/family';
import { addMonths, fmtMonth, monthEnd, monthStart, thisMonth } from '@/lib/dates';

export const metadata = { title: 'Davomat' };

const C: Record<string, { bg: string; l: string }> = {
  keldi: { bg: 'bg-[#1E8A4C] text-white', l: 'Keldi' },
  kechikdi: { bg: 'bg-[#FFC83D] text-[#0C1631]', l: 'Kechikdi' },
  sababli: { bg: 'bg-[#2F6FB5] text-white', l: 'Sababli' },
  kelmadi: { bg: 'bg-[#D93A08] text-white', l: 'Kelmadi' },
};

export default async function Attendance({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  const sp = await searchParams;
  const now = thisMonth();
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') && sp.oy! <= now ? sp.oy! : now;
  const rows = await db.execute<{ date: string; status: string; grp: string; reason: string | null }>(sql`
    select a.date::text, a.status::text, g.name grp, a.reason from attendance a join groups g on g.id = a.group_id
    where a.student_id = ${child.id} and a.date between ${monthStart(month)} and ${monthEnd(month)} order by a.date`);
  const by = new Map(rows.map((r) => [r.date, r]));
  const first = new Date(monthStart(month) + 'T00:00:00Z');
  const lead = (first.getUTCDay() + 6) % 7; // dushanbadan boshlanadi
  const days = Number(monthEnd(month).slice(8));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const count = (k: string) => rows.filter((r) => r.status === k).length;
  const present = count('keldi') + count('kechikdi');
  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between rounded-[24px] bg-white p-2">
        <Link href={`/ilova/davomat?oy=${addMonths(month, -1)}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F2F4F9]" aria-label="Oldingi oy">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <div className="text-[15px] font-extrabold">{fmtMonth(month)}</div>
          <div className="text-xs text-[#5B6478]">{rows.length ? `${present}/${rows.length} dars · ${Math.round((present / rows.length) * 100)}%` : 'Dars yo\'q'}</div>
        </div>
        {month < now ? (
          <Link href={`/ilova/davomat?oy=${addMonths(month, 1)}`} className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F2F4F9]" aria-label="Keyingi oy">
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>
      <section className="rounded-[24px] bg-white p-4">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-[#5B6478]">
          {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {cells.map((d, i) =>
            d ? (
              <div key={d} className={`grid aspect-square place-items-center rounded-xl text-sm font-extrabold tabular-nums ${by.get(d) ? C[by.get(d)!.status]?.bg : 'bg-[#F2F4F9] text-[#9AA3B5]'}`} title={by.get(d) ? `${C[by.get(d)!.status]?.l}, ${by.get(d)!.grp}` : undefined}>
                {Number(d.slice(8))}
              </div>
            ) : (
              <div key={`e${i}`} />
            ),
          )}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-2.5">
        {Object.entries(C).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 rounded-[20px] bg-white p-3">
            <span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-extrabold ${v.bg}`}>{count(k)}</span>
            <span className="text-sm font-bold">{v.l}</span>
          </div>
        ))}
      </div>
      {rows.some((r) => r.status !== 'keldi') && (
        <section className="rounded-[24px] bg-white p-4">
          <h2 className="mb-2 font-extrabold">Izohlar</h2>
          <ul className="space-y-1.5 text-sm">
            {rows
              .filter((r) => r.status !== 'keldi')
              .map((r) => (
                <li key={r.date} className="flex justify-between gap-3">
                  <span className="text-[#5B6478]">{Number(r.date.slice(8))}-sana · {r.grp}</span>
                  <span className="font-semibold">{C[r.status]?.l}{r.reason && r.reason !== 'QR' ? ` (${r.reason})` : ''}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
