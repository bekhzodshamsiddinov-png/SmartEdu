import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { GraduatesView } from './view';
import { getBranchScope } from '@/lib/branch';
import { andBranch } from '@/lib/branch';

export const metadata = { title: 'Bitiruvchilar' };

export default async function GraduatesPage() {
  const user = await requireSection('graduates');
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const scope = await getBranchScope();
  const rows = await db.execute<{
    id: number; name: string; phone: string | null; graduated_at: string | null; course: string | null; color: string | null;
    workplace: string | null; position: string | null; monthly_income: number | null; freelance: boolean | null; studying_at: string | null;
    last_contact_at: string | null; referrals: number | null; in_telegram_group: boolean | null; note: string | null; results: number;
  }>(sql`
    select s.id, s.full_name name, s.phone, s.graduated_at::text,
      (select c.name from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) course,
      (select c.color from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) color,
      gr.workplace, gr.position, gr.monthly_income, gr.freelance, gr.studying_at, gr.last_contact_at::text, gr.referrals, gr.in_telegram_group, gr.note,
      (select count(*) from results r where r.student_id = s.id)::int results
    from students s left join graduates gr on gr.student_id = s.id
    where s.status = 'bitirgan' ${andBranch('s.branch_id', scope.id)}
      ${mine ? sql`and exists (select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id and (g.teacher_id = ${user.id} or g.support_id = ${user.id}))` : sql``}
    order by s.graduated_at desc nulls last`);
  return <GraduatesView rows={[...rows]} />;
}
