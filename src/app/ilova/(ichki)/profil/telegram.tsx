'use client';
import { useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import { telegramConnect } from '@/app/actions/family';

export function TelegramButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await telegramConnect(id);
            if (r.ok && r.url) window.location.href = r.url;
            else setErr(r.error ?? 'Xatolik');
          })
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1878AE] text-sm font-extrabold text-white disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Telegramni ulash
      </button>
      {err && <p className="text-[13px] font-semibold text-[#C23B3B]">{err}</p>}
    </>
  );
}
