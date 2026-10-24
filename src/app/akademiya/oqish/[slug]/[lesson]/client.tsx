'use client';
import { useState, useTransition, type ReactNode } from 'react';
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
