import Link from 'next/link';
import { cn } from './ui';
import type { Period } from '@/lib/dates';

const P: { key: Period; label: string }[] = [
  { key: 'bugun', label: 'Bugun' },
  { key: 'hafta', label: 'Hafta' },
  { key: 'oy', label: 'Oy' },
  { key: 'yil', label: 'Yil' },
];

export function PeriodTabs({ value, base = '/', extra = '' }: { value: Period; base?: string; extra?: string }) {
  return (
    <div className="inline-flex rounded-field border border-line bg-white p-1" role="tablist" aria-label="Davr">
      {P.map((p) => (
        <Link
          key={p.key}
          href={`${base}?davr=${p.key}${extra}`}
          role="tab"
          aria-selected={value === p.key}
          className={cn(
            'rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold transition-colors',
            value === p.key ? 'bg-ink text-white' : 'text-fg-muted hover:text-fg',
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

export function parsePeriod(v: unknown): Period {
  return v === 'bugun' || v === 'hafta' || v === 'yil' ? v : 'oy';
}
