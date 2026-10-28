import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarClock, Coins, Flame, MapPin, Medal, QrCode, Star, Ticket, TrendingUp, Wallet } from 'lucide-react';
import { RESULT_META, RESULT_PLACES } from '@/lib/constants';
import { currentChild } from '@/lib/family';
import { childOverview } from '@/lib/family-data';
import { getSettings } from '@/lib/settings';
import { money } from '@/lib/format';
import { fmtDate, fmtShort, WEEKDAYS_FULL } from '@/lib/dates';

export const metadata = { title: 'Bosh sahifa' };

export default async function Home() {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  const [o, s] = await Promise.all([childOverview(child.id), getSettings()]);
  const first = child.name.split(' ')[0];
  const debt = o.balance < 0;
  return (
    <div className="space-y-4 pb-4">
      {/* Salomlashish va keyingi dars */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#0C1631] p-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#D93A08]/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-[#0B78A6]/30 blur-2xl" />
        <p className="relative text-sm text-white/60">Salom 👋</p>
        <h1 className="relative mt-0.5 text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
          {first}ning <span className="text-[#C4F03C]">o&apos;qishi</span>
        </h1>
        {o.next ? (
          <div className="relative mt-4 rounded-2xl bg-white/10 p-3.5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
              <CalendarClock className="h-3.5 w-3.5" /> {o.next.live ? 'Hozir darsda' : o.next.inDays === 0 ? 'Bugun' : o.next.inDays === 1 ? 'Ertaga' : WEEKDAYS_FULL[new Date(o.next.date + 'T00:00:00Z').getUTCDay()]}
            </div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-extrabold">{o.next.course}</div>
                <div className="truncate text-[13px] text-white/70">
                  {o.next.name}
                  {o.next.room && ` · ${o.next.room}-xona`}
                  {o.next.teacher && ` · ${o.next.teacher}`}
                </div>
              </div>
              <div className="shrink-0 text-right text-2xl font-extrabold tabular-nums text-[#C4F03C]">{o.next.start_time}</div>
            </div>
          </div>
        ) : (
          <p className="relative mt-4 text-sm text-white/70">Hozircha dars jadvali yo&apos;q.</p>
        )}
      </section>

      {/* Asosiy raqamlar */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Davomat" value={o.rate === null ? '—' : `${o.rate}%`} tone="#0B78A6" />
        <Stat icon={<Flame className="h-4 w-4" />} label="Ketma-ket" value={`${o.streak} dars`} tone="#D93A08" />
        <Stat icon={<Coins className="h-4 w-4" />} label="Coin" value={String(o.coins)} tone="#B8860B" />
      </div>

      {/* Balans */}
      <Link href="/ilova/tolov" className={`flex items-center gap-4 rounded-[24px] p-4 ${debt ? 'bg-[#D93A08] text-white' : 'bg-white'}`}>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${debt ? 'bg-white/15' : 'bg-[#FFF4ED] text-[#D93A08]'}`}>
          <Wallet className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-bold uppercase tracking-wider ${debt ? 'text-white/70' : 'text-[#5B6478]'}`}>{debt ? "To'lanmagan" : 'Hisobda'}</div>
          <div className="text-2xl font-extrabold tabular-nums">{money(Math.abs(o.balance))}</div>
        </div>
        <ArrowRight className="h-5 w-5 opacity-60" />
      </Link>

      {/* Abonement */}
      {o.subscriptions.map((x) => {
        const total = x.kind === 'dars' ? x.lessons_total : Math.max(1, (Date.parse(x.end_date) - Date.parse(x.start_date)) / 864e5 + 1);
        const left = x.kind === 'dars' ? x.lessons_total - x.used : Math.max(0, Math.round((Date.parse(x.end_date) - Date.now()) / 864e5) + 1);
        const pc = Math.max(4, Math.min(100, Math.round((left / total) * 100)));
        return (
          <div key={x.id} className="rounded-[24px] bg-[#FFC83D] p-4 text-[#0C1631]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <Ticket className="h-4 w-4" /> {x.name}
              </div>
              <span className="text-xs font-bold">{fmtDate(x.end_date)} gacha</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-3xl font-extrabold tabular-nums">{left}</div>
              <div className="pb-1 text-sm font-bold">{x.kind === 'dars' ? 'dars qoldi' : 'kun qoldi'}</div>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#0C1631]/15">
              <div className="h-full rounded-full bg-[#0C1631]" style={{ width: `${pc}%` }} />
            </div>
          </div>
        );
      })}

      {/* QR tezkor */}
      <Link href="/ilova/qr" className="flex items-center gap-4 rounded-[24px] bg-white p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C4F03C] text-[#0C1631]">
          <QrCode className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Darsga QR bilan kirish</div>
          <div className="text-[13px] text-[#5B6478]">Kodni o&apos;qituvchiga ko&apos;rsating</div>
        </div>
        <ArrowRight className="h-5 w-5 text-[#5B6478]" />
      </Link>

      {/* Oxirgi darslar */}
      <section className="rounded-[24px] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold">Oxirgi darslar</h2>
          <Link href="/ilova/davomat" className="text-[13px] font-bold text-[#D93A08]">
            Hammasi
          </Link>
        </div>
        {o.attendance.length === 0 ? (
          <p className="text-sm text-[#5B6478]">Hali davomat yo&apos;q.</p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {o.attendance.slice(0, 12).map((a) => (
              <div key={a.date} className={`flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 text-[11px] font-bold ${dot(a.status)}`}>
                <span className="opacity-70">{fmtShort(a.date).split(' ')[1] ?? ''}</span>
                <span className="text-base font-extrabold">{Number(a.date.slice(8))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Yutuqlar */}
      {o.wins.length > 0 && (
        <section className="rounded-[24px] bg-white p-4">
          <h2 className="mb-2 font-extrabold">{first}ning yutuqlari</h2>
          <ul className="space-y-2">
            {o.wins.map((w, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-[#F2F4F9] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: RESULT_META[w.type]?.color ?? '#8C9A97' }}>
                  <Medal className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{w.title}</span>
                  <span className="block text-xs text-[#5B6478]">
                    {w.type}
                    {RESULT_PLACES.find((p) => p.k === w.place) ? `, ${RESULT_PLACES.find((p) => p.k === w.place)!.l}` : ''}, {fmtShort(w.date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Baholar */}
      {o.grades.length > 0 && (
        <section className="rounded-[24px] bg-white p-4">
          <h2 className="mb-2 font-extrabold">Baholar</h2>
          <ul className="divide-y divide-[#E6EAEF]">
            {o.grades.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{g.period}</span>
                  {g.comment && <span className="block truncate text-xs text-[#5B6478]">{g.comment}</span>}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4ED] px-2.5 py-1 font-extrabold text-[#D93A08] tabular-nums">
                  <Star className="h-3.5 w-3.5" /> {g.score}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.address && (
        <p className="flex items-start gap-1.5 px-1 text-xs text-[#5B6478]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {s.address}
        </p>
      )}
    </div>
  );
}

const dot = (s: string) => (s === 'keldi' ? 'bg-[#E4F4EA] text-[#1E8A4C]' : s === 'kechikdi' ? 'bg-[#FFF4D6] text-[#9A6B00]' : s === 'sababli' ? 'bg-[#E6EFF9] text-[#2F6FB5]' : 'bg-[#FBE9E7] text-[#C23B3B]');

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[22px] bg-white p-3">
      <div className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: tone }}>
        {icon}
      </div>
      <div className="mt-2 text-lg font-extrabold tabular-nums">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#5B6478]">{label}</div>
    </div>
  );
}
