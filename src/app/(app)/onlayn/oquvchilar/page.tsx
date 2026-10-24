import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { LearnersView } from './view';

export const metadata = { title: "Onlayn o'quvchilar" };

export default async function LearnersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireSection('online');
  const rows = await db.execute<{ id: number; name: string; phone: string; email: string | null; telegram: string | null; city: string | null; source: string | null; created: string; courses: string | null; paid: string; orders: number }>(sql`
    select l.id, l.full_name name, l.phone, l.email, l.telegram, l.city, l.source, (l.created_at at time zone 'Asia/Tashkent')::date::text created,
      (select string_agg(c.title, ', ') from course_orders o join online_courses c on c.id = o.course_id where o.learner_id = l.id and o.status = 'tolandi') courses,
      (select coalesce(sum(amount),0) from course_orders o where o.learner_id = l.id and o.status = 'tolandi') paid,
      (select count(*) from course_orders o where o.learner_id = l.id)::int orders
    from learners l order by l.id desc`);
  const id = Number(sp.id);
  let detail = null;
  if (id) {
    const l = rows.find((r) => r.id === id);
    if (l) {
      const [orders, progress] = await Promise.all([
        db.execute<{ id: number; course: string; color: string; amount: number; status: string; paid_at: string | null; access_until: string | null; method: string }>(sql`
          select o.id, c.title course, c.color, o.amount, o.status, o.paid_at::text, o.access_until::text, o.method
          from course_orders o join online_courses c on c.id = o.course_id where o.learner_id = ${id} order by o.id desc`),
        db.execute<{ course: string; total: number; done: number; last: string | null }>(sql`
          select c.title course,
            (select count(*) from course_lessons cl where cl.course_id = c.id and cl.published)::int total,
            (select count(*) from lesson_progress p join course_lessons cl on cl.id = p.lesson_id where cl.course_id = c.id and cl.published and p.learner_id = ${id})::int done,
            (select max(p.completed_at)::date::text from lesson_progress p join course_lessons cl on cl.id = p.lesson_id where cl.course_id = c.id and p.learner_id = ${id}) last
          from online_courses c where c.id in (select course_id from course_orders where learner_id = ${id} and status = 'tolandi')`),
      ]);
      detail = { learner: l, orders: [...orders], progress: [...progress] };
    }
  }
  return <LearnersView rows={rows.map((r) => ({ ...r, paid: Number(r.paid) }))} detail={detail ? { ...detail, learner: { ...detail.learner, paid: Number(detail.learner.paid) } } : null} />;
}
