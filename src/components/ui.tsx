import Link from 'next/link';
import { clsx } from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

export function cn(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-field font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'bg-white text-fg border border-line-strong hover:bg-canvas',
  ghost: 'text-fg-muted hover:bg-canvas hover:text-fg',
  danger: 'bg-bad text-white hover:brightness-95',
  soft: 'bg-brand-soft text-brand-strong hover:bg-[#d3ece6]',
};
const btnSizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4', lg: 'h-12 px-5 text-[15px]', icon: 'h-9 w-9' };

export function buttonClass(variant: BtnVariant = 'primary', size: keyof typeof btnSizes = 'md', extra?: string) {
  return cn(btnBase, btnVariants[variant], btnSizes[size], extra);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...p
}: ComponentProps<'button'> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <button type="button" {...p} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...p
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <Link {...p} className={buttonClass(variant, size, className)} />;
}

export type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-fg-muted border-line',
  brand: 'bg-brand-soft text-brand-strong border-transparent',
  good: 'bg-good-soft text-good border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  bad: 'bg-bad-soft text-bad border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Card({ className, children, ...p }: ComponentProps<'div'>) {
  return (
    <div {...p} className={cn('card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-fg">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-fg-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-fg">{title}</h1>
        {sub && <p className="mt-1 text-sm text-fg-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-[13px] font-medium text-fg-muted">{label}</div>
      <div
        className={cn(
          'mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.02em] tnum',
          tone === 'good' && 'text-good',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-fg-muted">{hint}</div>}
    </>
  );
  const cls = 'card block px-4 py-4 sm:px-5';
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:border-line-strong')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>}
      <div className="text-[15px] font-bold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-fg-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 32, color }: { name: string; size?: number; color?: string }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color || '#1F4A50' }}
      aria-hidden
    >
      {ini}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'warn' | 'bad' | 'good' }) {
  const v = Math.max(0, Math.min(100, value));
  const c = { brand: 'bg-brand', warn: 'bg-warn', bad: 'bg-bad', good: 'bg-good' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
      <div className={cn('h-full rounded-full', c)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}
