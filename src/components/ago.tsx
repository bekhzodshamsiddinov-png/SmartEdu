'use client';
import { relative } from '@/lib/dates';

/** "5 daqiqa oldin" — server va brauzer soati bir daqiqaga farq qilsa ham ogohlantirish chiqmaydi */
export function Ago({ d }: { d: string | Date }) {
  const iso = typeof d === 'string' ? d : d.toISOString();
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {relative(d)}
    </time>
  );
}
