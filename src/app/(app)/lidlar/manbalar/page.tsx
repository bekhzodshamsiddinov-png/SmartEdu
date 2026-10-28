import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { addMonths, monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { andLeadBranch, getBranchScope } from '@/lib/branch';
import { SourcesView, type SrcRow } from './view';

export const metadata = { title: 'Manbalar hisoboti' };

/**
 * Qaysi kanal va qaysi reklama o'quvchi olib kelyapti.
 * Lid birinchi kelgan manbasi bo'yicha hisoblanadi (takroriy murojaatlar alohida ustunda).
 */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('leads');
  if (!['rahbar', 'admin', 'marketing'].includes(user.role)) redirect('/lidlar');
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const span = [1, 3, 6, 12].includes(Number(sp.oylar)) ? Number(sp.oylar) : 1;
  const fromMonth = addMonths(month, -(span - 1));
  const from = monthStart(fromMonth);
  const to = monthEnd(month);
  const scope = await getBranchScope();
  const B = scope.id;
  const [rows, repeats, spend, speed, daily, spendRows] = await Promise.all([
    db.execute<{ source: string; campaign: string | null; ad: string | null; leads: number; contacted: number; trial: number; came: number; paid: number; lost: number; open: number }>(sql`
      select source, campaign, ad, count(*)::int leads,
        count(*) filter (where max_stage >= 1 or stage <> 'yangi')::int contacted,
        count(*) filter (where max_stage >= 2)::int trial,
        count(*) filter (where max_stage >= 3)::int came,
        count(*) filter (where max_stage >= 4)::int paid,
        count(*) filter (where stage = 'rad_etdi')::int lost,
        count(*) filter (where stage not in ('tolov_qildi','rad_etdi'))::int open
      from leads where (created_at at time zone 'Asia/Tashkent')::date between ${from} and ${to} ${andLeadBranch('branch_id', B)}
      group by 1, 2, 3`),
    db.execute<{ source: string; c: number }>(sql`
      select t.source, count(*)::int c from lead_touches t join leads l on l.id = t.lead_id
      where (t.created_at at time zone 'Asia/Tashkent')::date between ${from} and ${to} and t.created_at > l.created_at + interval '1 minute' ${andLeadBranch('l.branch_id', B)}
      group by 1`),
    db.execute<{ source: string; campaign: string; amount: number }>(sql`
      select source, campaign, sum(amount)::bigint::float8 amount from ad_spend
      where month between ${fromMonth} and ${month} ${B ? sql`and (branch_id = ${B} or branch_id is null)` : sql``}
      group by 1, 2`),
    // Birinchi qo'ng'iroqgacha o'rtacha vaqt (daqiqa) — tez qo'ng'iroq qilingan lid ko'proq o'quvchiga aylanadi
    db.execute<{ source: string; minutes: number | null }>(sql`
      select l.source, percentile_cont(0.5) within group (order by extract(epoch from (n.first_at - l.created_at)) / 60)::float8 minutes
      from leads l join lateral (select min(created_at) first_at from notes where entity_type = 'lead' and entity_id = l.id and kind = 'qongiroq') n on n.first_at is not null
      where (l.created_at at time zone 'Asia/Tashkent')::date between ${from} and ${to} ${andLeadBranch('l.branch_id', B)}
      group by 1`),
    db.execute<{ d: string; source: string; c: number }>(sql`
      select to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD') d, source, count(*)::int c from leads
      where (created_at at time zone 'Asia/Tashkent')::date between ${from} and ${to} ${andLeadBranch('branch_id', B)} group by 1, 2 order by 1`),
    db.execute<{ id: number; month: string; source: string; campaign: string; amount: number; note: string | null; branch: string | null }>(sql`
      select a.id, a.month, a.source, a.campaign, a.amount, a.note, b.name branch from ad_spend a left join branches b on b.id = a.branch_id
      where a.month between ${fromMonth} and ${month} ${B ? sql`and (a.branch_id = ${B} or a.branch_id is null)` : sql``}
      order by a.month desc, a.source, a.campaign`),
  ]);
  return (
    <SourcesView
      month={month}
      span={span}
      rows={[...rows] as SrcRow[]}
      repeats={Object.fromEntries(repeats.map((r) => [r.source, r.c]))}
      spend={[...spend]}
      speed={Object.fromEntries(speed.map((r) => [r.source, r.minutes]))}
      daily={[...daily]}
      spendRows={[...spendRows]}
      canSpend={['rahbar', 'marketing'].includes(user.role)}
      from={from}
      to={to}
    />
  );
}
