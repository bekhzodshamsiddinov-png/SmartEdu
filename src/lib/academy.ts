import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { onlineCourses, courseModules, courseLessons } from '@/db/schema';
import { today } from './dates';

export const CATEGORIES: Record<string, string> = { ai: "Sun'iy intellekt", youtube: 'YouTube', boshqa: 'Boshqa' };

export async function publishedCourses() {
  return db.execute<{
    id: number; slug: string; title: string; subtitle: string | null; price: number; old_price: number | null; color: string; level: string;
    category: string; cover_url: string | null; lessons: number; minutes: number; free: number; students: number;
  }>(sql`
    select c.id, c.slug, c.title, c.subtitle, c.price, c.old_price, c.color, c.level, c.category, c.cover_url,
      (select count(*) from course_lessons l where l.course_id = c.id and l.published)::int lessons,
      (select coalesce(sum(duration_min),0) from course_lessons l where l.course_id = c.id and l.published)::int minutes,
      (select count(*) from course_lessons l where l.course_id = c.id and l.published and l.is_free)::int free,
      (select count(distinct learner_id) from course_orders o where o.course_id = c.id and o.status = 'tolandi')::int students
    from online_courses c where c.status = 'sotuvda' order by c.updated_at desc`);
}

export async function courseBySlug(slug: string) {
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.slug, slug));
  return c ?? null;
}

export async function curriculum(courseId: number) {
  const [mods, lessons] = await Promise.all([
    db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position), asc(courseModules.id)),
    db
      .select()
      .from(courseLessons)
      .where(and(eq(courseLessons.courseId, courseId), eq(courseLessons.published, true)))
      .orderBy(asc(courseLessons.position), asc(courseLessons.id)),
  ]);
  return mods
    .map((m) => ({ ...m, lessons: lessons.filter((l) => l.moduleId === m.id) }))
    .filter((m) => m.lessons.length > 0);
}

/** O'quvchining kursga kirish huquqi: to'langan va muddati o'tmagan buyurtma */
export async function hasAccess(learnerId: number | null | undefined, courseId: number) {
  if (!learnerId) return false;
  const [r] = await db.execute<{ ok: boolean }>(sql`
    select exists (select 1 from course_orders where learner_id = ${learnerId} and course_id = ${courseId}
      and status = 'tolandi' and (access_until is null or access_until >= ${today()})) ok`);
  return !!r?.ok;
}

/** Video havolasini pleyer manziliga aylantirish */
export function embedOf(url: string | null): { kind: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/)?.[1];
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? `?h=${vimeo[2]}` : ''}` };
  if (/iframe\.mediadelivery\.net|player\.mediadelivery\.net/.test(url)) return { kind: 'iframe', src: url.replace('/play/', '/embed/') };
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) return { kind: 'video', src: url };
  return { kind: 'iframe', src: url };
}
