import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { lockedBranch } from '@/lib/branch';
import { getSettings } from '@/lib/settings';
import { fmtDate } from '@/lib/dates';
import { PrintButton } from '@/app/chek/[id]/print';

export const metadata = { title: 'Sertifikat', robots: { index: false } };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireSection('students');
  if (u.role === 'bugalter') notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [s] = await db.execute<{ id: number; full_name: string; status: string; graduated_at: string | null; joined_at: string; branch_id: number | null }>(sql`
    select id, full_name, status::text, graduated_at::text, joined_at::text, branch_id from students where id = ${id}`);
  if (!s || s.status !== 'bitirgan') notFound();
  const locked = await lockedBranch();
  if (locked && s.branch_id && s.branch_id !== locked) notFound();
  if (u.role === 'oqituvchi' || u.role === 'support') {
    const [own] = await db.execute<{ c: number }>(sql`select count(*)::int c from enrollments e join groups g on g.id = e.group_id where e.student_id = ${id} and (g.teacher_id = ${u.id} or g.support_id = ${u.id})`);
    if (!own?.c) notFound();
  }
  const [e] = await db.execute<{ course: string; teacher: string | null; start_date: string; hours: number }>(sql`
    select c.name course, t.full_name teacher, e.start_date::text,
      (select count(*) from attendance a where a.student_id = e.student_id and a.group_id = e.group_id and a.status in ('keldi','kechikdi'))::int * 2 hours
    from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id left join users t on t.id = g.teacher_id
    where e.student_id = ${id} order by e.id desc limit 1`);
  const set = await getSettings();
  return (
    <main className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <style>{'@page { size: A4 landscape; margin: 0 }'}</style>
      <div className="mx-auto aspect-[297/210] w-[297mm] max-w-full bg-white p-[10mm] text-black shadow-sm print:shadow-none">
        <div className="flex h-full flex-col items-center justify-center rounded-[6mm] border-[3px] border-double border-[#0F2A2E] px-[16mm] text-center">
          <div className="text-[13px] font-bold uppercase tracking-[0.3em] text-[#0E7C6B]">{set.centerName}</div>
          <h1 className="mt-6 font-serif text-[44px] font-bold tracking-[0.08em] text-[#0F2A2E]">SERTIFIKAT</h1>
          <p className="mt-4 text-[15px] text-[#4a5a58]">Ushbu sertifikat</p>
          <p className="mt-2 font-serif text-[34px] font-bold italic text-[#0F2A2E]">{s.full_name}</p>
          <p className="mx-auto mt-4 max-w-[180mm] text-[15px] leading-relaxed text-[#4a5a58]">
            «{e?.course ?? 'kurs'}» yo&apos;nalishi bo&apos;yicha o&apos;quv kursini {e ? fmtDate(e.start_date) : fmtDate(s.joined_at)} — {s.graduated_at ? fmtDate(s.graduated_at) : ''} oralig&apos;ida muvaffaqiyatli tamomlagani uchun berildi
            {e?.hours ? ` (${e.hours} akademik soat)` : ''}.
          </p>
          <div className="mt-12 grid w-full grid-cols-2 gap-16 text-left text-[13px]">
            <div>
              <div className="border-t border-[#0F2A2E] pt-1.5">Rahbar</div>
            </div>
            <div>
              <div className="border-t border-[#0F2A2E] pt-1.5">O&apos;qituvchi{e?.teacher ? `: ${e.teacher}` : ''}</div>
            </div>
          </div>
          <div className="mt-6 text-[11px] text-[#6b7a78]">No {s.graduated_at?.slice(0, 4) ?? ''}-{String(s.id).padStart(4, '0')}</div>
        </div>
      </div>
      <div className="mt-5 flex justify-center print:hidden">
        <PrintButton />
      </div>
    </main>
  );
}
