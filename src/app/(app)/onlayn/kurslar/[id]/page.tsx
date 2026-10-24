import { notFound } from 'next/navigation';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { onlineCourses, courseModules, courseLessons } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { can } from '@/lib/roles';
import { CourseEditor } from './editor';

export const metadata = { title: 'Kurs' };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const user = await requireSection('online');
  const id = Number(raw);
  if (!id) notFound();
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, id));
  if (!c) notFound();
  const [mods, lessons, [st], buyers] = await Promise.all([
    db.select().from(courseModules).where(eq(courseModules.courseId, id)).orderBy(asc(courseModules.position), asc(courseModules.id)),
    db.select().from(courseLessons).where(eq(courseLessons.courseId, id)).orderBy(asc(courseLessons.position), asc(courseLessons.id)),
    db.execute<{ sales: number; revenue: string; pending: number }>(sql`
      select count(*) filter (where status = 'tolandi')::int sales, coalesce(sum(amount) filter (where status = 'tolandi'),0) revenue,
        count(*) filter (where status = 'kutilmoqda')::int pending from course_orders where course_id = ${id}`),
    db.execute<{ id: number; name: string; phone: string; paid_at: string | null; done: number }>(sql`
      select l.id, l.full_name name, l.phone, o.paid_at::text,
        (select count(*) from lesson_progress p join course_lessons cl on cl.id = p.lesson_id where p.learner_id = l.id and cl.course_id = ${id})::int done
      from course_orders o join learners l on l.id = o.learner_id where o.course_id = ${id} and o.status = 'tolandi' order by o.paid_at desc nulls last limit 8`),
  ]);
  return (
    <CourseEditor
      course={{ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }}
      modules={mods.map((m) => ({ ...m, lessons: lessons.filter((l) => l.moduleId === m.id).map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) }))}
      stats={{ sales: st.sales, revenue: Number(st.revenue), pending: st.pending }}
      buyers={[...buyers]}
      canEdit={can(user.role, 'onlineEdit')}
      isBoss={user.role === 'rahbar'}
    />
  );
}
