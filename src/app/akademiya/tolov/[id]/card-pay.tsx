'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Loader2 } from 'lucide-react';
import { reportPaid } from '@/app/actions/academy';
import { money } from '@/lib/format';

export function CardPay({ orderId, card, holder, amount, reported }: { orderId: number; card: string; holder: string | null; amount: number; reported: boolean }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const pretty = card.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl bg-ink p-5 text-white">
        <div className="text-xs font-semibold text-white/50">Karta raqami</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="font-mono text-[20px] font-bold tracking-wider">{pretty}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(card.replace(/\D/g, ''));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-bold hover:bg-white/20"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
        </div>
        {holder && <div className="mt-2 text-sm text-white/70">{holder}</div>}
        <div className="mt-3 text-sm">
          Summa: <b className="tnum">{money(amount)}</b>
        </div>
      </div>
      {!reported && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            start(async () => {
              const r = await reportPaid(orderId, fd);
              if (r.ok) router.refresh();
              else setErr(r.error);
            });
          }}
          className="space-y-3"
        >
          <input name="note" className="field h-11" placeholder="Qaysi kartadan to'ladingiz (oxirgi 4 raqam)" aria-label="Izoh" />
          {err && <p className="text-sm font-semibold text-bad">{err}</p>}
          <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong disabled:opacity-60">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} To&apos;ladim
          </button>
        </form>
      )}
    </div>
  );
}
