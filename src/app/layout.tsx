import '@fontsource-variable/manrope';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/toast';

export const metadata: Metadata = {
  title: { default: 'SmartEdu', template: '%s · SmartEdu' },
  description: "O'quv markaz boshqaruv tizimi",
};

export const viewport: Viewport = { themeColor: '#0F2A2E', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
