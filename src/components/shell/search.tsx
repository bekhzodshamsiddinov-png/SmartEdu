'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { globalSearch, type SearchHit } from '@/app/actions/search';

export function SearchBox() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => start(async () => setHits(await globalSearch(q))), 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="O'quvchi, lid yoki guruh qidirish"
        className="h-10 w-full rounded-field border border-line bg-white pl-9 pr-10 text-sm placeholder:text-fg-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        aria-label="Qidirish"
      />
      {pending && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-faint" />}
      {open && q.trim().length >= 2 && (
        <div className="anim-pop absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-line bg-white py-1.5 shadow-pop">
          {hits.length === 0 && !pending && <div className="px-4 py-3 text-sm text-fg-muted">Hech narsa topilmadi.</div>}
          {hits.map((h) => (
            <Link key={h.kind + h.id} href={h.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{h.title}</div>
                <div className="truncate text-xs text-fg-muted">{h.sub}</div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-fg-faint">{h.kindLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
