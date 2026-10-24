import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { can } from '@/lib/roles';
import { CoursesGrid } from './grid';

export const metadata = { title: 'Onlayn kurslar' };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('online');
  const rows = await db.execute<{
    id: number; title: string; subtitle: string | null; color: string; status: string; price: number; old_price: number | null; level: string;
    modules: number; lessons: number; minutes: number; sales: number; revenue: string; updated: string;
  }>(sql`
    select c.id, c.title, c.subtitle, c.color, c.status, c.price, c.old_price, c.level, c.updated_at::text updated,
      (select count(*) from course_modules m where m.course_id = c.id)::int modules,
      (select count(*) from course_lessons l where l.course_id = c.id)::int lessons,
      (select coalesce(sum(duration_min),0) from course_lessons l where l.course_id = c.id)::int minutes,
      (select count(*) from course_orders o where o.course_id = c.id and o.status = 'tolandi')::int sales,
      (select coalesce(sum(amount),0) from course_orders o where o.course_id = c.id and o.status = 'tolandi') revenue
    from online_courses c order by c.status = 'sotuvda' desc, c.updated_at desc`);
  return <CoursesGrid rows={rows.map((r) => ({ ...r, revenue: Number(r.revenue) }))} canEdit={can(user.role, 'onlineEdit')} openNew={sp.yangi === '1'} />;
}
