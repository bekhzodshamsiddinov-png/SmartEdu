'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Home, Magnet, Users, Layers, CalendarCheck, Wallet, Landmark, BriefcaseBusiness, ListChecks,
  GraduationCap, BarChart3, Settings, ClipboardCheck, Gauge, MonitorPlay, CalendarRange, MessageSquareText, Menu, X, LogOut, Plus, ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Avatar, cn } from '@/components/ui';
import { logout } from '@/app/actions/auth';
import { SearchBox } from './search';
import { BranchSwitcher } from './branch-switcher';
import type { NavItem } from './nav';

const ICONS: Record<string, typeof Home> = {
  home: Home, magnet: Magnet, users: Users, layers: Layers, check: CalendarCheck, wallet: Wallet,
  bank: Landmark, desk: ClipboardCheck, control: Gauge, play: MonitorPlay, brief: BriefcaseBusiness, tasks: ListChecks, grad: GraduationCap, chart: BarChart3, cog: Settings, schedule: CalendarRange, messages: MessageSquareText,
};

type QuickAdd = { href: string; label: string }[];

export function Shell({
  items,
  user,
  centerName,
  quick,
  branch,
  children,
}: {
  branch: { list: { id: number; name: string }[]; current: number | null; locked: boolean };
  items: NavItem[];
  user: { fullName: string; roleLabel: string };
  centerName: string;
  quick: QuickAdd;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const bottom = items.filter((i) => ['/ish-stoli', '/', '/davomat', '/oquvchilar', '/tolovlar', '/lidlar'].includes(i.href)).slice(0, 4);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Asosiy menyu">
      {items.map((it) => {
        const I = ICONS[it.icon] ?? Home;
        const on = active(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-semibold transition-colors',
              on ? 'bg-white/[0.09] text-white' : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            <I className={cn('h-[18px] w-[18px] shrink-0', on ? 'text-[#7CE0C8]' : 'text-white/50 group-hover:text-white/80')} strokeWidth={2} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="border-t border-white/[0.08] p-3">
      <div className="flex items-center gap-1 rounded-[10px] px-2 py-2">
        <Link href="/hisobim" title="Mening hisobim: parol va xavfsizlik" className="-ml-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.06]">
          <Avatar name={user.fullName} size={34} color="#0E7C6B" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white">{user.fullName}</div>
            <div className="truncate text-xs text-white/55">{user.roleLabel}</div>
          </div>
        </Link>
        <form action={logout}>
          <button className="grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white" title="Chiqish" aria-label="Chiqish">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-ink lg:flex">
        <div className="px-5 pb-3 pt-5">
          <Logo light />
          <div className="mt-1.5 truncate pl-[44px] text-xs font-medium text-white/45">{centerName}</div>
        </div>
        {nav}
        {userBox}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="anim-fade absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-ink" style={{ animation: 'slide-in .2s ease-out reverse' }}>
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <Logo light />
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-white/70" aria-label="Menyuni yopish">
                <X className="h-5 w-5" />
              </button>
            </div>
            {branch.list.length > 1 && !branch.locked && (
              <div className="px-4 pb-2 [&_select]:w-full [&_select]:max-w-none [&_label]:w-full">
                <BranchSwitcher branches={branch.list} current={branch.current} locked={branch.locked} />
              </div>
            )}
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-field text-fg lg:hidden" aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <SearchBox />
          </div>
          <div className="hidden sm:block">
            <BranchSwitcher branches={branch.list} current={branch.current} locked={branch.locked} />
          </div>
          {quick.length > 0 && <QuickAddMenu quick={quick} />}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Tezkor menyu">
        {bottom.map((it) => {
          const I = ICONS[it.icon] ?? Home;
          const on = active(it.href);
          return (
            <Link key={it.href} href={it.href} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', on ? 'text-brand' : 'text-fg-muted')}>
              <I className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-fg-muted">
          <Menu className="h-5 w-5" />
          Menyu
        </button>
      </nav>
    </div>
  );
}

function QuickAddMenu({ quick }: { quick: QuickAdd }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-field bg-brand px-3.5 text-sm font-bold text-white hover:bg-brand-strong"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        <span className="hidden sm:inline">Yangi</span>
        <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-pop">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="block px-4 py-2.5 text-sm font-semibold hover:bg-canvas">
                {q.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
