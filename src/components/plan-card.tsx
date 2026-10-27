import { Check, Flame } from 'lucide-react';
import { cn } from '@/components/ui';
import { money } from '@/lib/format';

export type PlanLite = { id: number; name: string; kind: string; months: number; lessons: number; valid_days: number; price: number; old_price: number | null; description: string | null; color: string; popular: boolean; course: string | null };

/** Abonement paketi kartasi: narx, chegirma, bir oy/dars narxi va nimalar kirishi */
export function PlanCard({ p, selected, onClick, compact }: { p: PlanLite; selected?: boolean; onClick?: () => void; compact?: boolean }) {
  const unit = p.kind === 'oy' ? Math.round(p.price / p.months) : Math.round(p.price / Math.max(1, p.lessons));
  const save = p.old_price && p.old_price > p.price ? Math.round(((p.old_price - p.price) / p.old_price) * 100) : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      className={cn(
        'relative flex w-full flex-col overflow-hidden rounded-[22px] border bg-white text-left transition-all',
        selected ? 'border-transparent ring-2 ring-[var(--c)] shadow-lift' : 'border-line hover:-translate-y-0.5 hover:shadow-lift',
        compact ? 'p-4' : 'p-5',
      )}
      style={{ ['--c' as string]: p.color }}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold tracking-[-0.01em]">{p.name}</div>
          <div className="text-xs font-semibold text-fg-muted">{p.course ?? "Barcha yo'nalishlar"}</div>
        </div>
        {p.popular && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white" style={{ background: p.color }}>
            <Flame className="h-3 w-3" /> Ommabop
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn('font-extrabold tracking-[-0.03em] tnum', compact ? 'text-2xl' : 'text-[30px]')}>{money(p.price)}</span>
        {p.old_price && p.old_price > p.price && <span className="text-sm font-semibold text-fg-faint line-through tnum">{money(p.old_price)}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <span className="rounded-full bg-canvas px-2 py-0.5 text-fg-muted">{p.kind === 'oy' ? `${p.months} oy` : `${p.lessons} dars · ${p.valid_days} kun`}</span>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-fg-muted tnum">
          {p.kind === 'oy' ? 'oyiga' : 'darsi'} {money(unit)}
        </span>
        {save > 0 && (
          <span className="rounded-full px-2 py-0.5 text-white" style={{ background: p.color }}>
            −{save}%
          </span>
        )}
      </div>
      {!compact && (
        <ul className="mt-4 space-y-1.5 text-[13px] text-fg-muted">
          <li className="flex gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
            {p.kind === 'oy' ? `${p.months} oy davomida oylik to'lov yo'q` : `${p.lessons} ta dars, ${p.valid_days} kun ichida`}
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
            Bir martalik to&apos;lov, qarz bo&apos;lmaydi
          </li>
          {p.description && (
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
              {p.description}
            </li>
          )}
        </ul>
      )}
    </Tag>
  );
}
