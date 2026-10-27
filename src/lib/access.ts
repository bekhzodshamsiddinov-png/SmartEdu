import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/** O'qituvchi/yordamchi faqat o'z guruhidagi o'quvchiga tegishi mumkin; boshqa rollar uchun cheklov yo'q */
export async function assertOwnStudent(u: { id: number; role: string }, studentId: number) {
  if (u.role !== 'oqituvchi' && u.role !== 'support') return;
  const [r] = await db.execute<{ c: number }>(sql`
    select count(*)::int c from enrollments e join groups g on g.id = e.group_id
    where e.student_id = ${studentId} and e.active and e.end_date is null and (g.teacher_id = ${u.id} or g.support_id = ${u.id})`);
  if (!r?.c) throw new Error("Bu o'quvchi sizning guruhingizda emas.");
}
