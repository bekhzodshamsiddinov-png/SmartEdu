import type { MetadataRoute } from 'next';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { siteUrl } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Faqat ochiq sahifalar: akademiya, kurslar va ariza formasi */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const courses = await db.execute<{ slug: string; updated_at: Date }>(sql`select slug, updated_at from online_courses where status = 'sotuvda' order by updated_at desc`);
  const last = courses[0]?.updated_at ?? new Date();
  return [
    { url: `${url}/akademiya`, lastModified: last, changeFrequency: 'weekly', priority: 1 },
    { url: `${url}/akademiya/ariza`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${url}/akademiya/yutuqlar`, changeFrequency: 'weekly', priority: 0.7 },
    ...courses.map((c) => ({ url: `${url}/akademiya/kurs/${c.slug}`, lastModified: c.updated_at, changeFrequency: 'weekly' as const, priority: 0.9 })),
  ];
}
