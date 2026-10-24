import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { courseBySlug, curriculum, hasAccess } from '@/lib/academy';
import { requireLearner } from '@/lib/learner';

export default async function ContinueCourse({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await requireLearner(`/akademiya/oqish/${slug}`);
  const c = await courseBySlug(slug);
  if (!c) notFound();
  if (!(await hasAccess(l.id, c.id))) redirect(`/akademiya/kurs/${slug}`);
  const lessons = (await curriculum(c.id)).flatMap((m) => m.lessons);
  if (!lessons.length) redirect(`/akademiya/kurs/${slug}`);
  const done = new Set(
    (await db.execute<{ lesson_id: number }>(sql`select lesson_id from lesson_progress where learner_id = ${l.id}`)).map((r) => r.lesson_id),
  );
  const next = lessons.find((x) => !done.has(x.id)) ?? lessons[0];
  redirect(`/akademiya/oqish/${slug}/${next.id}`);
}
