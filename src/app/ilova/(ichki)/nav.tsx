'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck2, Home, QrCode, Wallet } from 'lucide-react';

const ITEMS = [
  { href: '/ilova', l: 'Bosh', I: Home },
  { href: '/ilova/davomat', l: 'Davomat', I: CalendarCheck2 },
  { href: '/ilova/qr', l: 'QR', I: QrCode, big: true },
  { href: '/ilova/tolov', l: "To'lov", I: Wallet },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[calc(10px+env(safe-area-inset-bottom))]" aria-label="Ilova menyusi">
      <div className="flex items-center justify-around rounded-[26px] bg-[#0C1631] px-2 py-2 shadow-[0_12px_30px_-10px_rgba(12,22,49,0.5)]">
        {ITEMS.map(({ href, l, I, big }) => {
          const on = href === '/ilova' ? path === '/ilova' : path.startsWith(href);
          return big ? (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined} className="-mt-7 grid h-16 w-16 place-items-center rounded-[22px] bg-[#D93A08] text-white shadow-[0_10px_24px_-6px_rgba(217,58,8,0.7)] ring-4 ring-[#F2F4F9]" aria-label={l}>
              <I className="h-7 w-7" />
            </Link>
          ) : (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={`flex w-16 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-bold ${on ? 'text-[#C4F03C]' : 'text-white/60'}`}>
              <I className="h-5 w-5" />
              {l}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
