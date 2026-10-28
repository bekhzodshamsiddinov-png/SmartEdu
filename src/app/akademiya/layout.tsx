import Link from 'next/link';
import type { ReactNode } from 'react';
import { Phone, Send, Instagram, MapPin } from 'lucide-react';
import { getLearner } from '@/lib/learner';
import { getSettings } from '@/lib/settings';
import { phone } from '@/lib/format';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.academyTagline || "Sun'iy intellekt (ChatGPT, AI vositalari) va YouTube bo'yicha amaliy onlayn kurslar o'zbek tilida. Video darslar, topshiriqlar va sertifikat.";
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${s.centerName} Akademiya — AI va YouTube onlayn kurslari`, template: `%s · ${s.centerName} Akademiya` },
    description,
    applicationName: `${s.centerName} Akademiya`,
    keywords: ["sun'iy intellekt kursi", 'ChatGPT kursi', 'AI kurslari', 'YouTube kursi', 'onlayn kurslar', "o'zbek tilida", 'Namangan IT kurslari', s.centerName],
    alternates: { canonical: '/akademiya' },
    openGraph: { type: 'website', siteName: `${s.centerName} Akademiya`, locale: 'uz_UZ', title: `${s.centerName} Akademiya`, description, url: '/akademiya' },
    twitter: { card: 'summary_large_image', title: `${s.centerName} Akademiya`, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    formatDetection: { telephone: true },
  };
}

export default async function AcademyLayout({ children }: { children: ReactNode }) {
  const [l, s] = await Promise.all([getLearner(), getSettings()]);
  const tg = s.telegram?.replace(/^@/, '');
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F7]">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/akademiya" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden>
              <rect width="34" height="34" rx="9" fill="#0F2A2E" />
              <path d="M9 21.5c2.2 2 5 3 8 3 4.2 0 7-1.9 7-4.8 0-6-13-3.4-13-8.6 0-1.8 2-3.1 5.2-3.1 2.4 0 4.5.7 6.2 2" stroke="#7CE0C8" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </svg>
            <span className="leading-tight">
              <span className="block whitespace-nowrap text-[15px] font-extrabold tracking-[-0.01em]">{s.centerName}</span>
              <span className="block text-[11px] font-bold text-brand">Akademiya</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/akademiya#kurslar" className="hidden rounded-field px-3 py-2 text-sm font-semibold text-fg-muted hover:text-fg sm:block">
              Kurslar
            </Link>
            <Link href="/akademiya/yutuqlar" className="hidden rounded-field px-3 py-2 text-sm font-semibold text-fg-muted hover:text-fg sm:block">
              Yutuqlar
            </Link>
            {l ? (
              <Link href="/akademiya/kabinet" className="inline-flex h-10 items-center gap-2 rounded-field bg-ink px-4 text-sm font-bold text-white">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-[11px]">{l.fullName.slice(0, 1).toUpperCase()}</span>
                Kabinetim
              </Link>
            ) : (
              <>
                <Link href="/akademiya/kirish" className="rounded-field px-3 py-2 text-sm font-bold text-fg hover:text-brand">
                  Kirish
                </Link>
                <Link href="/akademiya/kirish?tab=royxat" className="inline-flex h-10 items-center rounded-field bg-brand whitespace-nowrap px-3 text-sm font-bold text-white hover:bg-brand-strong sm:px-4">
                  <span className="sm:hidden">Boshlash</span>
                  <span className="hidden sm:inline">Ro&apos;yxatdan o&apos;tish</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="text-lg font-extrabold">{s.centerName} Akademiya</div>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/65">
              {s.academyTagline || "Sun'iy intellekt va YouTube bo'yicha amaliy onlayn kurslar. Darslarni istalgan vaqtda, telefon yoki kompyuterdan ko'ring."}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="mb-3 font-bold text-white/50">Bog&apos;lanish</div>
            {s.phone && (
              <a href={`tel:+${s.phone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-white/85 hover:text-white">
                <Phone className="h-4 w-4" /> {phone(s.phone)}
              </a>
            )}
            {tg && (
              <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/85 hover:text-white">
                <Send className="h-4 w-4" /> @{tg}
              </a>
            )}
            {s.instagram && (
              <a href={`https://instagram.com/${s.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white/85 hover:text-white">
                <Instagram className="h-4 w-4" /> @{s.instagram.replace(/^@/, '')}
              </a>
            )}
            {s.address && (
              <span className="flex items-center gap-2 text-white/85">
                <MapPin className="h-4 w-4" /> {s.address}
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="mb-3 font-bold text-white/50">Akademiya</div>
            <Link href="/akademiya#kurslar" className="block text-white/85 hover:text-white">
              Barcha kurslar
            </Link>
            <Link href="/akademiya/yutuqlar" className="block text-white/85 hover:text-white">
              O&apos;quvchilar yutuqlari
            </Link>
            <Link href="/akademiya/kabinet" className="block text-white/85 hover:text-white">
              Shaxsiy kabinet
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/45">
          © {new Date().getFullYear()} {s.centerName}
        </div>
      </footer>
    </div>
  );
}
