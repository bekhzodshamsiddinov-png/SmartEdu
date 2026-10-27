import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { getBranchScope } from '@/lib/branch';
import { today } from '@/lib/dates';
import { Scanner } from './scanner';

export const metadata = { title: 'QR davomat' };

export default async function ScannerPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('attendance');
  const gid = Number(sp.guruh);
  if (!Number.isInteger(gid) || gid <= 0) notFound();
  const scope = await getBranchScope();
  const [g] = await db.execute<{ id: number; name: string; start_time: string; end_time: string; teacher_id: number | null; support_id: number | null; branch_id: number | null; course: string }>(sql`
    select g.id, g.name, g.start_time, g.end_time, g.teacher_id, g.support_id, g.branch_id, c.name course from groups g join courses c on c.id = g.course_id where g.id = ${gid}`);
  if (!g || (scope.id && g.branch_id && g.branch_id !== scope.id)) notFound();
  if ((user.role === 'oqituvchi' || user.role === 'support') && g.teacher_id !== user.id && g.support_id !== user.id) notFound();
  const t = today();
  const members = await db.execute<{ id: number; name: string; status: string | null }>(sql`
    select s.id, s.full_name name, a.status::text status from enrollments e join students s on s.id = e.student_id
    left join attendance a on a.student_id = s.id and a.group_id = e.group_id and a.date = ${t}
    where e.group_id = ${gid} and e.start_date <= ${t} and (e.end_date is null or e.end_date >= ${t}) order by s.full_name`);
  return <Scanner group={{ id: g.id, name: g.name, course: g.course, time: `${g.start_time}–${g.end_time}` }} members={[...members]} />;
}
