import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { BrandMark } from '@/components/brand-mark';
import { getSettings } from '@/lib/settings';
import { tokenHash } from '@/lib/family';
import { clientIp, overLimit } from '@/lib/security';
import { joinFamily } from '@/app/actions/family';

export const metadata = { title: 'Ilovaga ulanish' };
export const dynamic = 'force-dynamic';

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) notFound();
  if (await overLimit('kabinet', await clientIp(), 120, 10)) notFound();
  const [st] = await db.execute<{ name: string }>(sql`select full_name name from students where cabinet_hash = ${tokenHash(token)}`);
  if (!st) notFound();
  const s = await getSettings();
  const first = st.name.split(' ')[0];
  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-md place-items-center px-5 py-10">
      <div className="w-full text-center">
        <BrandMark className="mx-auto h-16 w-16" />
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-[#0B78A6]">{s.centerName}</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{first}ni ilovaga qo&apos;shamizmi?</h1>
        <p className="mt-2 text-[15px] text-[#5B6478]">{st.name} — davomat, to&apos;lovlar va QR kod shu telefonda ko&apos;rinadi.</p>
        <form action={joinFamily.bind(null, token)} className="mt-8">
          <button className="h-14 w-full rounded-2xl bg-[#D93A08] text-base font-extrabold text-white shadow-[0_12px_28px_-10px_rgba(217,58,8,0.8)]">Ilovaga qo&apos;shish</button>
        </form>
        <p className="mt-4 text-xs text-[#5B6478]">Bu havolani boshqalarga bermang.</p>
      </div>
    </div>
  );
}
