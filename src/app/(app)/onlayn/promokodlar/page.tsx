import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { can } from '@/lib/roles';
import { PromoView } from './view';

export const metadata = { title: 'Promokodlar' };

export default async function PromoPage() {
  const user = await requireSection('online');
  const [rows, courses] = await Promise.all([
    db.execute<{ id: number; code: string; percent: number | null; amount: number | null; course_id: number | null; course: string | null; max_uses: number | null; used: number; valid_until: string | null; active: boolean; revenue: string }>(sql`
      select p.id, p.code, p.percent, p.amount, p.course_id, c.title course, p.max_uses, p.used, p.valid_until::text, p.active,
        (select coalesce(sum(o.amount),0) from course_orders o where o.promo_code = p.code and o.status = 'tolandi') revenue
      from promo_codes p left join online_courses c on c.id = p.course_id order by p.active desc, p.id desc`),
    db.execute<{ id: number; title: string }>(sql`select id, title from online_courses order by title`),
  ]);
  return <PromoView rows={rows.map((r) => ({ ...r, revenue: Number(r.revenue) }))} courses={[...courses]} canEdit={can(user.role, 'onlineEdit')} />;
}
