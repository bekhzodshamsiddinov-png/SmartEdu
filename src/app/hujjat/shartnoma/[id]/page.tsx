import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { lockedBranch } from '@/lib/branch';
import { getSettings } from '@/lib/settings';
import { money, phone } from '@/lib/format';
import { fmtDate, today } from '@/lib/dates';
import { DEFAULT_CONTRACT, fillContract } from '@/lib/contract';
import { PrintButton } from '@/app/chek/[id]/print';

export const metadata = { title: 'Shartnoma', robots: { index: false } };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireSection('students');
  if (!['rahbar', 'admin', 'sotuv'].includes(u.role)) notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [s] = await db.execute<{ id: number; full_name: string; phone: string | null; parent_name: string | null; parent_phone: string | null; branch_id: number | null; branch: string | null }>(sql`
    select s.id, s.full_name, s.phone, s.parent_name, s.parent_phone, s.branch_id, b.name branch from students s left join branches b on b.id = s.branch_id where s.id = ${id}`);
  if (!s) notFound();
  const locked = await lockedBranch();
  if (locked && s.branch_id && s.branch_id !== locked) notFound();
  const [e] = await db.execute<{ grp: string; course: string; months: number; days: string; start_time: string; end_time: string; fee: number; start_date: string }>(sql`
    select g.name grp, c.name course, c.duration_months months, g.days, g.start_time, g.end_time, e.monthly_fee fee, e.start_date::text
    from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id
    where e.student_id = ${id} order by (e.end_date is null) desc, e.id desc limit 1`);
  const set = await getSettings();
  const text = fillContract(set.contractTemplate || DEFAULT_CONTRACT, {
    raqam: `${today().slice(0, 4)}/${s.id}`,
    shahar: set.address?.split(',')[0] || 'Namangan',
    sana: fmtDate(e?.start_date ?? today()),
    markaz: set.centerName,
    manzil: set.address ?? '',
    markaz_tel: set.phone ? phone(set.phone) : '',
    oquvchi: s.full_name,
    ota_ona: s.parent_name || s.full_name,
    ota_ona_tel: s.parent_phone ? phone(s.parent_phone) : s.phone ? phone(s.phone) : '',
    kurs: e?.course ?? '________',
    guruh: e?.grp ?? '____',
    muddat: String(e?.months ?? '__'),
    kunlar: e?.days.split(',').join(', ') ?? '____',
    vaqt: e ? `${e.start_time}–${e.end_time}` : '____',
    narx: e ? money(e.fee) : '________',
    tolov_kuni: String(set.paymentDueDay),
  });
  return (
    <main className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <article className="mx-auto w-[210mm] max-w-full whitespace-pre-wrap bg-white px-[18mm] py-[16mm] font-serif text-[13px] leading-relaxed text-black shadow-sm print:shadow-none">{text}</article>
      <div className="mt-5 flex justify-center print:hidden">
        <PrintButton />
      </div>
    </main>
  );
}
