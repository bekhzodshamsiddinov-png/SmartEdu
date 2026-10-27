import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addMonths, monthEnd, monthStart, MONTHS_SHORT } from './dates';
import { andBranch } from './branch';

const n = (v: unknown) => Number(v ?? 0);

/** Filial bo'yicha: to'lovlar o'quvchining filialiga, xarajatlar o'z filialiga bog'lanadi. Onlayn sotuv filialga bog'lanmaydi. */
export async function incomeExpense(from: string, to: string, branch: number | null = null) {
  const [r] = await db.execute<{ pay: string; inc: string; exp: string; onl: string }>(sql`
    select
      (select coalesce(sum(p.amount),0) from payments p where p.cancelled_at is null and p.paid_at between ${from} and ${to} ${andBranch('p.branch_id', branch)}) as pay,
      ${branch ? sql`0` : sql`(select coalesce(sum(amount),0) from course_orders where status = 'tolandi' and paid_at between ${from} and ${to})`} as onl,
      (select coalesce(sum(amount),0) from transactions where type='kirim' and category <> 'Boshlang''ich qoldiq' and date between ${from} and ${to} ${andBranch('branch_id', branch)}) as inc,
      (select coalesce(sum(amount),0) from transactions where type='chiqim' and date between ${from} and ${to} ${andBranch('branch_id', branch)}) as exp`);
  const income = n(r.pay) + n(r.inc) + n(r.onl);
  const expense = n(r.exp);
  return { tuition: n(r.pay), online: n(r.onl), otherIncome: n(r.inc), income, expense, profit: income - expense };
}

export async function monthlySeries(lastMonth: string, count = 12, branch: number | null = null) {
  const first = addMonths(lastMonth, -(count - 1));
  const from = monthStart(first);
  const to = monthEnd(lastMonth);
  const rows = await db.execute<{ m: string; kirim: string; xarajat: string }>(sql`
    with p as (select to_char(p.paid_at,'YYYY-MM') m, sum(p.amount) s from payments p where p.cancelled_at is null and p.paid_at between ${from} and ${to} ${andBranch('p.branch_id', branch)} group by 1),
         i as (select to_char(date,'YYYY-MM') m, sum(amount) s from transactions where type='kirim' and category <> 'Boshlang''ich qoldiq' and date between ${from} and ${to} ${andBranch('branch_id', branch)} group by 1),
         o as (select to_char(paid_at,'YYYY-MM') m, sum(amount) s from course_orders where status='tolandi' and paid_at between ${from} and ${to} ${branch ? sql`and false` : sql``} group by 1),
         e as (select to_char(date,'YYYY-MM') m, sum(amount) s from transactions where type='chiqim' and date between ${from} and ${to} ${andBranch('branch_id', branch)} group by 1),
         ms as (select m from p union select m from i union select m from o union select m from e)
    select ms.m, coalesce(p.s,0)+coalesce(i.s,0)+coalesce(o.s,0) kirim, coalesce(e.s,0) xarajat
    from ms left join p on p.m=ms.m left join i on i.m=ms.m left join o on o.m=ms.m left join e on e.m=ms.m`);
  const map = new Map(rows.map((r) => [r.m, r]));
  const out: { month: string; label: string; kirim: number; xarajat: number }[] = [];
  for (let k = 0; k < count; k++) {
    const m = addMonths(first, k);
    const r = map.get(m);
    out.push({ month: m, label: MONTHS_SHORT[Number(m.slice(5)) - 1], kirim: n(r?.kirim), xarajat: n(r?.xarajat) });
  }
  return out;
}

export async function studentFlow(from: string, to: string, branch: number | null = null) {
  const [r] = await db.execute<{ active: number; joined: number; left: number; grad: number; frozen: number }>(sql`
    select
      count(*) filter (where status in ('faol','xavf'))::int as active,
      count(*) filter (where joined_at between ${from} and ${to})::int as joined,
      count(*) filter (where left_at between ${from} and ${to})::int as left,
      count(*) filter (where graduated_at between ${from} and ${to})::int as grad,
      count(*) filter (where status='muzlatilgan')::int as frozen
    from students where true ${andBranch('branch_id', branch)}`);
  return r;
}

export async function attendanceRate(from: string, to: string, branch: number | null = null) {
  const [r] = await db.execute<{ total: number; present: number }>(sql`
    select count(*)::int total, count(*) filter (where a.status in ('keldi','kechikdi'))::int present
    from attendance a join groups g on g.id = a.group_id where a.date between ${from} and ${to} ${andBranch('g.branch_id', branch)}`);
  return { ...r, rate: r.total ? (r.present / r.total) * 100 : NaN };
}

export async function leftReasons(from: string, to: string, branch: number | null = null) {
  return db.execute<{ reason: string; c: number; returned: number }>(sql`
    select coalesce(left_reason,'Sabab yozilmagan') reason, count(*)::int c,
      count(*) filter (where return_result='Qaytdi')::int returned
    from students where left_at between ${from} and ${to} ${andBranch('branch_id', branch)} group by 1 order by 2 desc`);
}

export async function funnel(from: string, to: string, branch: number | null = null) {
  const [r] = await db.execute<{ total: number; contacted: number; trial: number; came: number; paid: number; lost: number }>(sql`
    select count(*)::int total,
      count(*) filter (where max_stage >= 1)::int contacted,
      count(*) filter (where max_stage >= 2)::int trial,
      count(*) filter (where max_stage >= 3)::int came,
      count(*) filter (where max_stage >= 4)::int paid,
      count(*) filter (where stage = 'rad_etdi')::int lost
    from leads where created_at::date between ${from} and ${to} ${andBranch('branch_id', branch)}`);
  return r;
}

export async function revenueByCourse(from: string, to: string, branch: number | null = null) {
  return db.execute<{ id: number | null; name: string; color: string; s: string }>(sql`
    select c.id, coalesce(c.name,'Guruhsiz') name, coalesce(c.color,'#8C9A97') color, sum(p.amount) s
    from payments p
    left join enrollments e on e.id = p.enrollment_id
    left join groups g on g.id = e.group_id
    left join courses c on c.id = g.course_id
    where p.cancelled_at is null and p.paid_at between ${from} and ${to} ${andBranch('p.branch_id', branch)}
    group by c.id, c.name, c.color order by s desc`);
}

export async function studentsByCourse(branch: number | null = null) {
  return db.execute<{ id: number; name: string; color: string; c: number }>(sql`
    select c.id, c.name, c.color, count(distinct s.id)::int c
    from courses c
    left join groups g on g.course_id = c.id ${andBranch('g.branch_id', branch)}
    left join enrollments e on e.group_id = g.id and e.active = true and e.end_date is null
    left join students s on s.id = e.student_id and s.status in ('faol','xavf')
    where c.active = true
    group by c.id, c.name, c.color order by c desc`);
}

export async function expensesByCategory(from: string, to: string, branch: number | null = null) {
  return db.execute<{ category: string; s: string }>(sql`
    select category, sum(amount) s from transactions where type='chiqim' and date between ${from} and ${to} ${andBranch('branch_id', branch)} group by 1 order by 2 desc`);
}

/** Filiallar taqqoslamasi (rahbar uchun) */
export async function branchComparison(from: string, to: string) {
  return db.execute<{ id: number; name: string; active: number; joined: number; left: number; tuition: string; other: string; expense: string; groups: number }>(sql`
    select b.id, b.name,
      (select count(*) from students s where s.branch_id = b.id and s.status in ('faol','xavf'))::int active,
      (select count(*) from students s where s.branch_id = b.id and s.joined_at between ${from} and ${to})::int joined,
      (select count(*) from students s where s.branch_id = b.id and s.left_at between ${from} and ${to})::int "left",
      (select coalesce(sum(p.amount),0) from payments p where p.cancelled_at is null and p.branch_id = b.id and p.paid_at between ${from} and ${to}) tuition,
      (select coalesce(sum(amount),0) from transactions t where t.branch_id = b.id and t.type = 'kirim' and t.category <> 'Boshlang''ich qoldiq' and t.date between ${from} and ${to}) other,
      (select coalesce(sum(amount),0) from transactions t where t.branch_id = b.id and t.type = 'chiqim' and t.date between ${from} and ${to}) expense,
      (select count(*) from groups g where g.branch_id = b.id and g.active)::int groups
    from branches b where b.active order by b.id`);
}
