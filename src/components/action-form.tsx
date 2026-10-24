'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { ActionResult } from '@/lib/action';
import { useToast } from './toast';
import { Button } from './ui';

export function ActionForm({
  action,
  children,
  submitLabel = 'Saqlash',
  successText,
  onDone,
  onCancel,
  danger,
  className,
  resetOnSuccess,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  successText?: string;
  onDone?: (r: ActionResult) => void;
  onCancel?: () => void;
  danger?: boolean;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setError(null);
        start(async () => {
          const r = await action(fd);
          if (r.ok) {
            toast(r.message || successText || 'Saqlandi');
            if (resetOnSuccess) form.reset();
            router.refresh();
            onDone?.(r);
          } else {
            setError(r.error);
          }
        });
      }}
    >
      <div className="space-y-4">{children}</div>
      {error && (
        <div className="mt-4 rounded-field border border-bad/20 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad" role="alert">
          {error}
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Bekor qilish
          </Button>
        )}
        <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Bitta tugma bilan server action chaqirish */
export function ActionButton({
  action,
  children,
  confirm,
  successText,
  variant = 'secondary',
  size = 'sm',
  className,
  title,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  confirm?: string;
  successText?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'icon';
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      title={title}
      aria-label={title}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          if (r.ok) {
            toast(r.message || successText || 'Bajarildi');
            router.refresh();
          } else toast(r.error, 'err');
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  );
}
