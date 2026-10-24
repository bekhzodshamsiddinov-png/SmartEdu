'use client';
import { useState } from 'react';

/** Summani 1 250 000 ko'rinishida yozish uchun maydon */
export function MoneyInput({ name, defaultValue, placeholder = '0', required, autoFocus }: { name: string; defaultValue?: number | null; placeholder?: string; required?: boolean; autoFocus?: boolean }) {
  const fmt = (v: string) => v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const [v, setV] = useState(defaultValue ? fmt(String(defaultValue)) : '');
  return (
    <div className="relative">
      <input
        name={name}
        value={v}
        onChange={(e) => setV(fmt(e.target.value))}
        inputMode="numeric"
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="field pr-14 tnum"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-faint">so&apos;m</span>
    </div>
  );
}
