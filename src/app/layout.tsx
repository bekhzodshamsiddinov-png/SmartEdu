import '@fontsource-variable/manrope';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { ToastProvider } from '@/components/toast';

export const metadata: Metadata = {
  title: { default: 'SmartEdu', template: '%s · SmartEdu' },
  description: "O'quv markaz boshqaruv tizimi",
};

export const viewport: Viewport = { themeColor: '#0F2A2E', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Har bir so'rovda yangi CSP nonce: sahifa dinamik render qilinadi va Next skriptlariga nonce qo'yadi
  await headers();
  return (
    <html lang="uz">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
