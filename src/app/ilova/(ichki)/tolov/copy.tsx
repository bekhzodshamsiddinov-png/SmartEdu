'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyCard({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value.replace(/\s/g, ''));
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
      className="flex w-full items-center gap-3 rounded-2xl bg-[#0C1631] p-4 text-left text-white"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-white/60">{label}</div>
        <div className="mt-0.5 text-lg font-extrabold tracking-wider tabular-nums">{value}</div>
      </div>
      {ok ? <Check className="h-5 w-5 text-[#C4F03C]" /> : <Copy className="h-5 w-5 text-white/60" />}
    </button>
  );
}
