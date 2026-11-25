import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { lockedBranch } from '@/lib/branch';
import { getChildren } from '@/lib/family';

export const dynamic = 'force-dynamic';

/**
 * Yutuq faylini ko'rsatish. Ochiq havola emas: faqat xodim (o'z filiali, o'qituvchi — o'z o'quvchisi)
 * yoki shu bolaga ulangan ota-ona ilovasi ko'ra oladi.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Topilmadi', { status: 404 });
  const [f] = await db.execute<{ name: string; mime: string; data: Buffer; student_id: number; branch_id: number | null }>(sql`
    select f.name, f.mime, f.data, r.student_id, s.branch_id
    from result_files f join results r on r.id = f.result_id join students s on s.id = r.student_id
    where f.id = ${id}`);
  if (!f) return new Response('Topilmadi', { status: 404 });

  let ok = false;
  const u = await getCurrentUser();
  if (u && can(u.role, 'students')) {
    const locked = await lockedBranch();
    ok = !locked || !f.branch_id || f.branch_id === locked;
    if (ok && (u.role === 'oqituvchi' || u.role === 'support')) {
      const [r] = await db.execute<{ c: number }>(sql`
        select count(*)::int c from enrollments e join groups g on g.id = e.group_id
        where e.student_id = ${f.student_id} and (g.teacher_id = ${u.id} or g.support_id = ${u.id})`);
      ok = !!r?.c;
    }
  }
  if (!ok) ok = (await getChildren()).some((k) => k.id === f.student_id);
  if (!ok) return new Response('Ruxsat yo\'q', { status: 403 });

  const download = new URL(req.url).searchParams.has('yukla');
  const ascii = f.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(new Uint8Array(f.data), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=600',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
