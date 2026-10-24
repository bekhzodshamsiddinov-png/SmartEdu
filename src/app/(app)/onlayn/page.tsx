import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { MonitorPlay, Plus } from 'lucide-react';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { can } from '@/lib/roles';
import { addDays, fmtShort, monthEnd, monthStart, thisMonth, today, MONTHS_SHORT } from '@/lib/dates';
import { money, num } from '@/lib/format';
import { ORDER_STATUS, COURSE_STATUS } from '@/lib/constants';
import { Badge, Card, CardHeader, Empty, LinkButton, PageHeader, Stat } from '@/components/ui';
import { OnlineTabs } from '@/components/online/tabs';
import { DayBars } from '@/components/charts/day-bars';

export const metadata = { title: 'Onlayn kurslar' };

export default async function OnlineHome() {
  const user = await requireSection('online');
  const t = today();
  const m = thisMonth();
  const from30 = addDays(t, -29);
  const [[k], daily, top, recent, [pend]] = await Promise.all([
    db.execute<{ revenue: string; sales: number; learners: number; new_learners: number; courses: number }>(sql`
      select
        (select coalesce(sum(amount),0) from course_orders where status = 'tolandi' and paid_at between ${monthStart(m)} and ${monthEnd(m)}) revenue,
        (select count(*) from course_orders where status = 'tolandi' and paid_at between ${monthStart(m)} and ${monthEnd(m)})::int sales,
        (select count(*) from learners)::int learners,
        (select count(*) from learners where created_at::date between ${monthStart(m)} and ${monthEnd(m)})::int new_learners,
        (select count(*) from online_courses where status = 'sotuvda')::int courses`),
    db.execute<{ d: string; s: string; c: number }>(sql`select paid_at::text d, sum(amount) s, count(*)::int c from course_orders where status = 'tolandi' and paid_at between ${from30} and ${t} group by 1`),
    db.execute<{ id: number; title: string; color: string; status: string; price: number; sales: number; revenue: string; lessons: number }>(sql`
      select c.id, c.title, c.color, c.status, c.price,
        (select count(*) from course_orders o where o.course_id = c.id and o.status = 'tolandi')::int sales,
        (select coalesce(sum(amount),0) from course_orders o where o.course_id = c.id and o.status = 'tolandi') revenue,
        (select count(*) from course_lessons l where l.course_id = c.id)::int lessons
      from online_courses c order by revenue desc, c.id desc limit 6`),
    db.execute<{ id: number; name: string; course: string; amount: number; status: string; created: string }>(sql`
      select o.id, l.full_name name, c.title course, o.amount, o.status, o.created_at::date::text created
      from course_orders o join learners l on l.id = o.learner_id join online_courses c on c.id = o.course_id order by o.id desc limit 8`),
    db.execute<{ c: number; s: string }>(sql`select count(*)::int c, coalesce(sum(amount),0) s from course_orders where status = 'kutilmoqda'`),
  ]);
  const dm = new Map(daily.map((d) => [d.d, d]));
  const chart = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from30, i);
    const r = dm.get(d);
    return { label: `${Number(d.slice(8))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]}`, value: Number(r?.s ?? 0), count: r?.c ?? 0 };
  });
  const revenue = Number(k.revenue);
  const canEdit = can(user.role, 'onlineEdit');

  return (
    <>
      <PageHeader
        title="Onlayn kurslar"
        sub="AI kurslaringiz, sotuvlar va onlayn o'quvchilar"
        actions={
          <>
            <a href="/akademiya" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-field border border-line-strong bg-white px-4 text-sm font-semibold hover:bg-canvas">
              Akademiya sayti
            </a>
            <LinkButton variant="secondary" href="/onlayn/sotuvlar?yangi=1">
              <Plus className="h-4 w-4" /> Sotuv qo&apos;shish
            </LinkButton>
            {canEdit && (
              <LinkButton href="/onlayn/kurslar?yangi=1">
                <Plus className="h-4 w-4" /> Yangi kurs
              </LinkButton>
            )}
          </>
        }
      />
      <OnlineTabs active="/onlayn" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tushum, shu oy" value={money(revenue, false)} hint={k.sales ? `O'rtacha chek ${money(revenue / k.sales)}` : "so'm"} />
        <Stat label="Sotuvlar, shu oy" value={num(k.sales)} tone={k.sales ? 'good' : 'neutral'} />
        <Stat label="Onlayn o'quvchilar" value={num(k.learners)} hint={`Shu oy +${k.new_learners}`} href="/onlayn/oquvchilar" />
        <Stat label="To'lov kutilmoqda" value={num(pend.c)} tone={pend.c ? 'warn' : 'neutral'} hint={money(Number(pend.s))} href="/onlayn/sotuvlar?holat=kutilmoqda" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Kunlik sotuvlar" sub="Oxirgi 30 kun, so'm" />
          <div className="px-3 pb-4 sm:px-5">
            <DayBars data={chart} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Oxirgi buyurtmalar" action={<Link href="/onlayn/sotuvlar" className="text-[13px] font-bold text-brand hover:underline">Hammasi</Link>} />
          {recent.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-fg-muted">Hali sotuv yo&apos;q.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{o.name}</div>
                    <div className="truncate text-xs text-fg-muted">
                      {o.course}, {fmtShort(o.created)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tnum">{money(o.amount)}</div>
                    <Badge tone={ORDER_STATUS[o.status]?.tone ?? 'neutral'}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Kurslar" sub={`${k.courses} ta kurs sotuvda`} action={<Link href="/onlayn/kurslar" className="text-[13px] font-bold text-brand hover:underline">Barcha kurslar</Link>} />
        {top.length === 0 ? (
          <Empty icon={<MonitorPlay className="h-5 w-5" />} title="Hali onlayn kurs yo'q" text="Birinchi AI kursingizni yarating: modullar, video darslar va narx." action={canEdit ? <LinkButton href="/onlayn/kurslar?yangi=1">Kurs yaratish</LinkButton> : undefined} />
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[640px]">
              <thead className="bg-canvas/60">
                <tr>
                  <th className="th">Kurs</th>
                  <th className="th">Holat</th>
                  <th className="th text-right">Darslar</th>
                  <th className="th text-right">Narx</th>
                  <th className="th text-right">Sotuvlar</th>
                  <th className="th text-right">Tushum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {top.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas/60">
                    <td className="td">
                      <Link href={`/onlayn/kurslar/${c.id}`} className="flex items-center gap-2.5 font-bold hover:text-brand">
                        <span className="h-3 w-3 rounded" style={{ background: c.color }} />
                        {c.title}
                      </Link>
                    </td>
                    <td className="td">
                      <Badge tone={COURSE_STATUS[c.status]?.tone ?? 'neutral'}>{COURSE_STATUS[c.status]?.label ?? c.status}</Badge>
                    </td>
                    <td className="td text-right tnum">{c.lessons}</td>
                    <td className="td text-right tnum">{money(c.price)}</td>
                    <td className="td text-right tnum">{c.sales}</td>
                    <td className="td text-right font-bold tnum">{money(Number(c.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
