'use client';
import Link from 'next/link';
import { cn } from '@/components/ui';

const T = [
  { href: '/onlayn', l: 'Umumiy' },
  { href: '/onlayn/kurslar', l: 'Kurslar' },
  { href: '/onlayn/sotuvlar', l: 'Sotuvlar' },
  { href: '/onlayn/oquvchilar', l: "O'quvchilar" },
  { href: '/onlayn/promokodlar', l: 'Promokodlar' },
];

export function OnlineTabsClient({ active }: { active: string }) {
  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1" aria-label="Onlayn kurslar bo'limlari">
      {T.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? 'page' : undefined}
          className={cn('shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors', active === t.href ? 'bg-ink text-white' : 'text-fg-muted hover:bg-white hover:text-fg')}
        >
          {t.l}
        </Link>
      ))}
    </nav>
  );
}
