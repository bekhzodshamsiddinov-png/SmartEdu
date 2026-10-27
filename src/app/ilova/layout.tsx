import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getSettings } from '@/lib/settings';
import { SwRegister } from './sw-register';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.centerName} — ota-ona ilovasi`, template: `%s · ${s.centerName}` },
    description: "Farzandingizning davomati, to'lovlari, abonementi va QR davomat — bitta ilovada.",
    manifest: '/manifest.webmanifest',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    appleWebApp: { capable: true, title: s.centerName, statusBarStyle: 'default' },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = { themeColor: '#0C1631', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#F2F4F9] text-[#0C1631]">
      <SwRegister />
      {children}
    </div>
  );
}
