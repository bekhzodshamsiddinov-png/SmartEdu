import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { andBranch, getBranchScope } from '@/lib/branch';
import { today } from '@/lib/dates';
import { AchievementsView } from './view';

export const metadata = { title: 'Yutuqlar' };

export default async function AchievementsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('students');
  const scope = await getBranchScope();
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const year = /^\d{4}$/.test(sp.yil ?? '') ? sp.yil : 'hammasi';
  const rows = await db.execute<{
    id: number; type: string; title: string; amount: number | null; date: string; note: string | null; place: string | null; level: string | null; link: string | null; isPublic: boolean;
    student_id: number; name: string; status: string; course: string | null; color: string | null;
  }>(sql`
    select r.id, r.type, r.title, r.amount, r.date::text, r.note, r.place, r.level, r.link, r.is_public "isPublic",
      s.id student_id, s.full_name name, s.status::text,
      (select c.name from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) course,
      (select c.color from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) color
    from results r join students s on s.id = r.student_id
    where true ${andBranch('s.branch_id', scope.id)}
      ${year !== 'hammasi' ? sql`and extract(year from r.date) = ${Number(year)}` : sql``}
      ${mine ? sql`and exists (select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id and (g.teacher_id = ${user.id} or g.support_id = ${user.id}))` : sql``}
    order by r.date desc, r.id desc limit 500`);
  const years = await db.execute<{ y: string }>(sql`select distinct extract(year from date)::int::text y from results order by 1 desc`);
  return (
    <AchievementsView
      rows={[...rows]}
      year={year}
      years={[...new Set([today().slice(0, 4), ...years.map((y) => y.y)])]}
      canAdd={!['bugalter', 'sotuv'].includes(user.role)}
      canEdit={['rahbar', 'admin', 'marketing'].includes(user.role)}
    />
  );
}
