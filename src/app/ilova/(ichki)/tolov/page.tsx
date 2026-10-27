import { redirect } from 'next/navigation';
import { Phone, Ticket } from 'lucide-react';
import { currentChild } from '@/lib/family';
import { childLedger, childOverview } from '@/lib/family-data';
import { getSettings } from '@/lib/settings';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtShort } from '@/lib/dates';
import { CopyCard } from './copy';

export const metadata = { title: "To'lovlar" };

export default async function Payments() {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  const [o, ledger, s] = await Promise.all([childOverview(child.id), childLedger(child.id), getSettings()]);
  const debt = o.balance < 0;
  const monthly = o.groups.reduce((a, g) => a + g.fee, 0);
  return (
    <div className="space-y-4 pb-4">
      <section className={`rounded-[28px] p-5 ${debt ? 'bg-[#D93A08] text-white' : 'bg-[#0C1631] text-white'}`}>
        <div className="text-xs font-bold uppercase tracking-wider text-white/70">{debt ? "To'lanishi kerak" : 'Hisobdagi qoldiq'}</div>
        <div className="mt-1 text-[34px] font-extrabold tracking-[-0.02em] tabular-nums">{money(Math.abs(o.balance))}</div>
        <div className="mt-1 text-sm text-white/70">Oylik to&apos;lov: {money(monthly)}{s.paymentDueDay ? ` · har oyning ${s.paymentDueDay}-sanasigacha` : ''}</div>
      </section>

      {(s.payCard || s.phone) && (
        <section className="space-y-2.5 rounded-[24px] bg-white p-4">
          <h2 className="font-extrabold">Qanday to&apos;lash mumkin</h2>
          {s.payCard && <CopyCard label={`Karta${s.payCardHolder ? ` · ${s.payCardHolder}` : ''}`} value={s.payCard.replace(/(\d{4})(?=\d)/g, '$1 ')} />}
          <p className="text-[13px] text-[#5B6478]">To&apos;lovdan so&apos;ng chekni administratorga yuboring yoki markazda naqd to&apos;lang.</p>
          {s.phone && (
            <a href={`tel:+${s.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F2F4F9] text-sm font-extrabold">
              <Phone className="h-4 w-4" /> {phone(s.phone)}
            </a>
          )}
        </section>
      )}

      {o.subscriptions.length > 0 && (
        <section className="rounded-[24px] bg-white p-4">
          <h2 className="mb-2 font-extrabold">Abonement</h2>
          {o.subscriptions.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-1.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFC83D]">
                <Ticket className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-bold">{x.name}</div>
                <div className="text-xs text-[#5B6478]">
                  {x.kind === 'dars' ? `${x.lessons_total - x.used} dars qoldi · ` : ''}
                  {fmtDate(x.end_date)} gacha
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-[24px] bg-white p-4">
        <h2 className="mb-1 font-extrabold">Tarix</h2>
        {ledger.length === 0 ? (
          <p className="py-3 text-sm text-[#5B6478]">Hali yozuv yo&apos;q.</p>
        ) : (
          <ul className="divide-y divide-[#E6EAEF]">
            {ledger.slice(0, 60).map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-2.5">
                <span className="w-12 shrink-0 text-xs font-bold text-[#5B6478] tabular-nums">{fmtShort(r.date)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{r.title}</div>
                  {r.sub && <div className="truncate text-xs text-[#5B6478]">{r.sub}</div>}
                </div>
                <span className={`text-sm font-extrabold tabular-nums ${r.amount > 0 ? 'text-[#1E8A4C]' : ''}`}>
                  {r.amount > 0 ? '+' : '−'}
                  {money(Math.abs(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
