'use client';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Loader2, ChevronDown } from 'lucide-react';
import { completeLesson, uncompleteLesson } from '@/app/actions/academy';

export function CompleteToggle({ lessonId, done, nextHref }: { lessonId: number; done: boolean; nextHref: string | null }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(done);
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (on) {
            await uncompleteLesson(lessonId);
            setOn(false);
            router.refresh();
          } else {
            const r = await completeLesson(lessonId);
            if (r.ok) {
              setOn(true);
              if (nextHref) router.push(nextHref);
              else router.refresh();
            }
          }
        })
      }
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-field px-4 text-sm font-bold ${on ? 'bg-good-soft text-good' : 'bg-brand text-white hover:bg-brand-strong'}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      {on ? 'Tugatildi' : nextHref ? 'Tugatdim, keyingisi' : 'Tugatdim'}
    </button>
  );
}

export function MobileOutline({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold" aria-expanded={open}>
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-line p-2">{children}</div>}
    </div>
  );
}

/** Videoga o'quvchi ismi va raqami suv belgisi sifatida tushadi — ekrandan yozib tarqatgan odam aniqlanadi */
export function Watermark({ text }: { text: string }) {
  const spots = [
    'left-[6%] top-[8%]',
    'right-[6%] top-[30%]',
    'left-[30%] bottom-[18%]',
    'right-[12%] bottom-[8%]',
    'left-[8%] top-[55%]',
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % spots.length), 15000);
    return () => clearInterval(t);
  }, [spots.length]);
  return (
    <span aria-hidden className={`pointer-events-none absolute z-10 select-none whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold text-white/35 transition-all duration-1000 sm:text-xs ${spots[i]}`}>
      {text}
    </span>
  );
}
