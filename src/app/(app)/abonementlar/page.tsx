import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { getBranchScope } from '@/lib/branch';
import { courseOptions } from '@/lib/options';
import { today } from '@/lib/dates';
import { SubscriptionsView } from './view';

export const metadata = { title: 'Abonementlar' };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('subscriptions');
  const scope = await getBranchScope();
  const B = scope.id;
  const [plans, sold, copts] = await Promise.all([
    db.execute<{ id: number; name: string; course_id: number | null; course: string | null; kind: string; months: number; lessons: number; valid_days: number; price: number; old_price: number | null; description: string | null; color: string; popular: boolean; active: boolean; sold: number }>(sql`
      select p.id, p.name, p.course_id, c.name course, p.kind, p.months, p.lessons, p.valid_days, p.price, p.old_price, p.description, p.color, p.popular, p.active,
        (select count(*) from student_subscriptions s where s.plan_id = p.id)::int sold
      from subscription_plans p left join courses c on c.id = p.course_id order by p.active desc, p.position, p.price`),
    db.execute<{ id: number; student_id: number; student: string; grp: string; name: string; kind: string; start_date: string; end_date: string; lessons_total: number; used: number; price: number; status: string; refund: number; cancel_reason: string | null }>(sql`
      select ss.id, ss.student_id, st.full_name student, g.name grp, ss.name, ss.kind, ss.start_date::text, ss.end_date::text, ss.lessons_total,
        (select count(*) from charges c where c.subscription_id = ss.id and c.kind = 'abonement_dars')::int used,
        ss.price, ss.status, ss.refund, ss.cancel_reason
      from student_subscriptions ss join students st on st.id = ss.student_id join enrollments e on e.id = ss.enrollment_id join groups g on g.id = e.group_id
      ${B ? sql`where st.branch_id = ${B}` : sql``}
      order by (ss.status = 'faol' and ss.end_date >= ${today()}) desc, ss.end_date, ss.id desc limit 300`),
    courseOptions(),
  ]);
  return (
    <SubscriptionsView
      plans={[...plans]}
      sold={[...sold]}
      courses={copts}
      today={today()}
      isBoss={user.role === 'rahbar'}
      canCancel={user.role === 'rahbar' || user.role === 'admin'}
      tab={sp.tab === 'sotilgan' ? 'sotilgan' : 'paketlar'}
    />
  );
}
