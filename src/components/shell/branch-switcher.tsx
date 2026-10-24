'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { setBranch } from '@/app/actions/branch';

export function BranchSwitcher({ branches, current, locked }: { branches: { id: number; name: string }[]; current: number | null; locked: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (branches.length < 2 && !locked) return null;
  if (locked) {
    return (
      <span className="hidden h-10 items-center gap-2 rounded-field border border-line bg-white px-3 text-[13px] font-semibold sm:inline-flex">
        <Building2 className="h-4 w-4 text-fg-muted" />
        {branches.find((b) => b.id === current)?.name}
      </span>
    );
  }
  return (
    <label className="relative inline-flex h-10 items-center">
      {pending ? <Loader2 className="pointer-events-none absolute left-3 h-4 w-4 animate-spin text-fg-muted" /> : <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-fg-muted" />}
      <select
        value={current ?? ''}
        onChange={(e) =>
          start(async () => {
            await setBranch(e.target.value ? Number(e.target.value) : null);
            router.refresh();
          })
        }
        className="h-10 max-w-[150px] appearance-none rounded-field border border-line bg-white pl-9 pr-3 text-[13px] font-semibold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:max-w-[220px]"
        aria-label="Filial"
      >
        <option value="">Barcha filiallar</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
