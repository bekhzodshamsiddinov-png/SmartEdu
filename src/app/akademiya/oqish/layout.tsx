import type { ReactNode } from 'react';

/** Dars sahifalari faqat sotib olganlar uchun — qidiruvda ko'rinmaydi */
export const metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
