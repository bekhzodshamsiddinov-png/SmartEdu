import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { lockedBranch } from '@/lib/branch';
import { getSettings } from '@/lib/settings';
import { getBalances } from '@/lib/finance';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtMonth } from '@/lib/dates';
import { PrintButton } from './print';

export const metadata = { title: 'Chek', robots: { index: false } };

const METHOD: Record<string, string> = { naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme', bank: "Bank o'tkazmasi" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('payments');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [p] = await db.execute<{ id: number; amount: number; method: string; paid_at: string; for_month: string | null; note: string | null; cancelled: boolean; student_id: number; student: string; sphone: string | null; branch_id: number | null; by: string | null; grp: string | null; created: string }>(sql`
    select p.id, p.amount, p.method::text, p.paid_at::text, p.for_month, p.note, p.cancelled_at is not null cancelled,
      s.id student_id, s.full_name student, s.phone sphone, coalesce(p.branch_id, s.branch_id) branch_id, u.full_name by,
      (select g.name || ' (' || c.name || ')' from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id
        where e.id = p.enrollment_id or (p.enrollment_id is null and e.student_id = p.student_id and e.end_date is null) order by e.id limit 1) grp,
      to_char(p.created_at at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI') created
    from payments p join students s on s.id = p.student_id left join users u on u.id = p.received_by_id where p.id = ${id}`);
  if (!p) notFound();
  const locked = await lockedBranch();
  if (locked && p.branch_id && p.branch_id !== locked) notFound();
  const [s, balances] = await Promise.all([getSettings(), getBalances()]);
  const bal = balances.get(p.student_id)?.balance ?? 0;

  return (
    <main className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <div className="mx-auto w-[80mm] max-w-full bg-white px-5 py-6 font-mono text-[12px] leading-relaxed text-black shadow-sm print:shadow-none">
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase">{s.centerName}</div>
          {s.address && <div>{s.address}</div>}
          {s.phone && <div>Tel: {phone(s.phone)}</div>}
        </div>
        <Dash />
        <div className="text-center font-bold">TO&apos;LOV CHEKI No {p.id}</div>
        {p.cancelled && <div className="mt-1 border border-black py-0.5 text-center font-bold">BEKOR QILINGAN</div>}
        <Dash />
        <Row l="Sana" v={p.created} />
        <Row l="O'quvchi" v={p.student} />
        {p.sphone && <Row l="Telefon" v={phone(p.sphone)} />}
        {p.grp && <Row l="Guruh" v={p.grp} />}
        {p.for_month && <Row l="Qaysi oy uchun" v={fmtMonth(p.for_month)} />}
        <Row l="To'lov kuni" v={fmtDate(p.paid_at)} />
        <Row l="Usul" v={METHOD[p.method] ?? p.method} />
        {p.note && <Row l="Izoh" v={p.note} />}
        <Dash />
        <div className="flex items-baseline justify-between text-[15px] font-bold">
          <span>JAMI</span>
          <span>{money(p.amount)}</span>
        </div>
        <Row l={bal < 0 ? 'Qolgan qarz' : 'Hisobdagi qoldiq'} v={money(Math.abs(bal))} />
        <Dash />
        {p.by && <Row l="Qabul qildi" v={p.by} />}
        <div className="mt-6 flex justify-between">
          <span>Imzo: ________</span>
        </div>
        <div className="mt-5 text-center">Rahmat! Bilimingiz — kelajagingiz.</div>
      </div>
      <div className="mt-5 flex justify-center print:hidden">
        <PrintButton />
      </div>
    </main>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{l}:</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function Dash() {
  return <div className="my-2 border-t border-dashed border-black" />;
}
