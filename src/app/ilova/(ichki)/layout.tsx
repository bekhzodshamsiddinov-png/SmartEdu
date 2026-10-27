import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentChild, getChildren } from '@/lib/family';
import { getSettings } from '@/lib/settings';
import { BrandMark } from '@/components/brand-mark';
import { BottomNav } from './nav';

export const dynamic = 'force-dynamic';

export default async function Inner({ children }: { children: ReactNode }) {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  const [kids, s] = await Promise.all([getChildren(), getSettings()]);
  return (
    <div className="mx-auto min-h-[100dvh] max-w-md pb-[calc(84px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[#F2F4F9]/90 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur">
        <BrandMark className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#0B78A6]">{s.centerName}</div>
          <div className="truncate text-[15px] font-extrabold">{child.name}</div>
        </div>
        <Link href="/ilova/profil" className="relative grid h-10 w-10 place-items-center rounded-full bg-[#0C1631] text-sm font-extrabold text-white" aria-label="Profil">
          {child.name.slice(0, 1)}
          {kids.length > 1 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#D93A08] px-1 text-[10px]">{kids.length}</span>}
        </Link>
      </header>
      <main className="px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
