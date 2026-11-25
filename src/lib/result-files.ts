import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export type FileMeta = { id: number; name: string; mime: string; size: number };

/** Yutuqlar fayllari ro'yxati (faqat nomi va turi — faylning o'zi /api/yutuq-fayl orqali ruxsat bilan ochiladi) */
export async function filesFor(resultIds: number[]): Promise<Map<number, FileMeta[]>> {
  const m = new Map<number, FileMeta[]>();
  if (!resultIds.length) return m;
  const rows = await db.execute<FileMeta & { result_id: number }>(sql`
    select id, result_id, name, mime, size from result_files
    where result_id in (${sql.join(resultIds.map((i) => sql`${i}`), sql`, `)}) order by id`);
  for (const r of rows) {
    const { result_id, ...f } = r;
    m.set(result_id, [...(m.get(result_id) ?? []), f]);
  }
  return m;
}
