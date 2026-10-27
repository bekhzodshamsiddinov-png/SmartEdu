import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, LogOut, Phone, Plus, Send } from 'lucide-react';
import { currentChild, getChildren } from '@/lib/family';
import { getSettings } from '@/lib/settings';
import { phone } from '@/lib/format';
import { leaveChild, selectChild } from '@/app/actions/family';
import { TelegramButton } from './telegram';
import { InstallHint } from './install';

export const metadata = { title: 'Profil' };

export default async function Profile() {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  const [kids, s] = await Promise.all([getChildren(), getSettings()]);
  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-[24px] bg-white p-4">
        <h2 className="mb-2 font-extrabold">Farzandlarim</h2>
        <ul className="space-y-2">
          {kids.map((k) => (
            <li key={k.id} className="flex items-center gap-3">
              <form action={selectChild.bind(null, k.id)} className="min-w-0 flex-1">
                <button className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${k.id === child.id ? 'bg-[#0C1631] text-white' : 'bg-[#F2F4F9]'}`}>
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${k.id === child.id ? 'bg-[#C4F03C] text-[#0C1631]' : 'bg-white'}`}>{k.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{k.name}</span>
                  {k.id === child.id && <Check className="h-4 w-4 text-[#C4F03C]" />}
                </button>
              </form>
              <form action={leaveChild.bind(null, k.id)}>
                <button className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F2F4F9] text-[#5B6478]" aria-label={`${k.name} ni ilovadan olib tashlash`}>
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
        <Link href="/ilova/ulanish" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D7DCE5] text-sm font-bold text-[#5B6478]">
          <Plus className="h-4 w-4" /> Yana farzand qo&apos;shish
        </Link>
      </section>
      <section className="space-y-2 rounded-[24px] bg-white p-4">
        <h2 className="font-extrabold">Xabarnomalar</h2>
        <p className="text-[13px] text-[#5B6478]">To&apos;lov, darsga kelmaslik va eslatmalar Telegram orqali kelsin.</p>
        <TelegramButton id={child.id} />
      </section>
      <InstallHint />
      <section className="space-y-2 rounded-[24px] bg-white p-4">
        <h2 className="font-extrabold">{s.centerName}</h2>
        {s.address && <p className="text-[13px] text-[#5B6478]">{s.address}</p>}
        <div className="grid grid-cols-2 gap-2">
          {s.phone && (
            <a href={`tel:+${s.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F2F4F9] text-sm font-bold">
              <Phone className="h-4 w-4" /> {phone(s.phone)}
            </a>
          )}
          {s.telegram && (
            <a href={`https://t.me/${s.telegram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#E8F4FB] text-sm font-bold text-[#1878AE]">
              <Send className="h-4 w-4" /> Telegram
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
