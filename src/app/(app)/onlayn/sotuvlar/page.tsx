import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { SalesView } from './view';

export const metadata = { title: 'Sotuvlar' };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('online');
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const holat = sp.holat ?? '';
  const [orders, courses, learners] = await Promise.all([
    db.execute<{ id: number; learner_id: number; name: string; phone: string; course_id: number; course: string; color: string; amount: number; original_price: number; promo_code: string | null; method: string; status: string; paid_at: string | null; access_until: string | null; created: string; note: string | null; by: string | null }>(sql`
      select o.id, l.id learner_id, l.full_name name, l.phone, c.id course_id, c.title course, c.color, o.amount, o.original_price, o.promo_code, o.method, o.status,
        o.paid_at::text, o.access_until::text, (o.created_at at time zone 'Asia/Tashkent')::date::text created, o.note, u.full_name by
      from course_orders o join learners l on l.id = o.learner_id join online_courses c on c.id = o.course_id left join users u on u.id = o.created_by_id
      where ${holat === 'kutilmoqda' ? sql`o.status = 'kutilmoqda'` : sql`(o.created_at at time zone 'Asia/Tashkent')::date between ${monthStart(month)} and ${monthEnd(month)}`}
      order by o.id desc`),
    db.execute<{ id: number; title: string; price: number; status: string }>(sql`select id, title, price, status from online_courses where status <> 'yopiq' order by status = 'sotuvda' desc, title`),
    db.execute<{ id: number; name: string; phone: string }>(sql`select id, full_name name, phone from learners order by id desc limit 500`),
  ]);
  return (
    <SalesView
      month={month}
      holat={holat}
      orders={[...orders]}
      courses={[...courses]}
      learners={[...learners]}
      openNew={sp.yangi === '1'}
      presetCourse={Number(sp.kurs) || null}
      isBoss={user.role === 'rahbar'}
    />
  );
}
