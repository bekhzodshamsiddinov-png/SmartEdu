import { Logo } from '@/components/logo';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo light />
        <div className="relative z-10 max-w-md">
          <p className="text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em]">
            O&apos;quv markazingizning har bir o&apos;quvchisi, darsi va so&apos;mi — bitta joyda.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Davomat, to&apos;lovlar, lidlar va moliya. Ma&apos;lumotlar sizning bazangizda saqlanadi.
          </p>
        </div>
        <Schedule />
      </aside>
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function Schedule() {
  const rows = [
    { t: '09:00', g: "AI-3 · Sun'iy intellekt", s: '12/12' },
    { t: '14:00', g: 'FS-1 · Fullstack AI', s: '9/10' },
    { t: '16:00', g: 'KS-5 · Kompyuter savodxonligi', s: '14/15' },
  ];
  return (
    <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 text-[13px] font-semibold text-white/60">Bugungi darslar</div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-4 text-sm">
            <span className="w-12 font-bold tnum text-[#7CE0C8]">{r.t}</span>
            <span className="flex-1 text-white/90">{r.g}</span>
            <span className="tnum text-white/60">{r.s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
