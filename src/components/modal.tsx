'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './ui';

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function useLockAndEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useLockAndEsc(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea')?.focus(), 30);
  }, [open]);
  const mounted = useMounted();
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'anim-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[17px] font-bold">{title}</h2>
            {sub && <p className="mt-0.5 text-[13px] text-fg-muted">{sub}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-canvas" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  header?: ReactNode;
}) {
  useLockAndEsc(open, onClose);
  const mounted = useMounted();
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="anim-slide relative flex h-full w-full max-w-2xl flex-col bg-canvas shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                <h2 className="truncate text-lg font-bold">{title}</h2>
                {sub && <div className="mt-0.5 text-[13px] text-fg-muted">{sub}</div>}
              </>
            )}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:bg-canvas" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
