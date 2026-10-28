import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { GraduatesView, type GradRow } from './view';
import { andBranch, getBranchScope } from '@/lib/branch';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Bitiruvchilar' };

export default async function GraduatesPage() {
  const user = await requireSection('graduates');
  const mine = user.role === 'oqituvchi' || user.role === 'support';
  const showIncome = user.role === 'rahbar' || user.role === 'admin';
  const scope = await getBranchScope();
  const s = await getSettings();
  const rows = await db.execute<GradRow>(sql`
    select s.id, s.full_name name, s.phone, s.graduated_at::text,
      (select c.name from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) course,
      (select c.color from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.student_id = s.id order by e.start_date desc limit 1) color,
      gr.workplace, gr.position, ${showIncome ? sql`gr.monthly_income` : sql`null::int`} monthly_income, gr.freelance, gr.studying_at, gr.last_contact_at::text, gr.next_contact_at::text,
      coalesce(gr.referrals, 0) referrals, gr.in_telegram_group, gr.note, gr.field, gr.socials,
      (select count(*) from results r where r.student_id = s.id)::int results,
      (select count(*) from leads l where l.referred_by_student_id = s.id)::int ref_leads,
      (select count(*) from leads l where l.referred_by_student_id = s.id and l.max_stage >= 4)::int ref_paid,
      (select count(*) from graduate_contacts c where c.student_id = s.id)::int contacts
    from students s left join graduates gr on gr.student_id = s.id
    where s.status = 'bitirgan' ${andBranch('s.branch_id', scope.id)}
      ${mine ? sql`and exists (select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id and (g.teacher_id = ${user.id} or g.support_id = ${user.id}))` : sql``}
    order by s.graduated_at desc nulls last`);
  return <GraduatesView rows={[...rows]} showIncome={showIncome} contactDays={s.alumniContactDays || 90} canAddResult={['rahbar', 'admin', 'marketing'].includes(user.role)} />;
}
