'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, TicketPercent } from 'lucide-react';
import { buyCourse, checkPromo } from '@/app/actions/academy';
import { money } from '@/lib/format';

export function BuyBox({ courseId, price, loggedIn, slug, pendingOrder }: { courseId: number; price: number; loggedIn: boolean; slug: string; pendingOrder: number | null }) {
  const [state, action, pending] = useActionState(buyCourse, undefined);
  const [promoOpen, setPromoOpen] = useState(false);
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<{ price: number; error?: string } | null>(null);
  const [checking, start] = useTransition();
  const final = quote && !quote.error ? quote.price : price;

  if (!loggedIn) {
    return (
      <div className="mt-6 space-y-2">
        <Link href={`/akademiya/kirish?tab=royxat&next=${encodeURIComponent(`/akademiya/kurs/${slug}`)}`} className="flex h-12 items-center justify-center rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong">
          Kursni sotib olish
        </Link>
        <p className="text-center text-xs text-fg-muted">Avval 30 soniyada ro&apos;yxatdan o&apos;tasiz</p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {promoOpen ? (
        <div>
          <div className="flex gap-2">
            <input
              name="promo"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setQuote(null);
              }}
              className="field uppercase"
              placeholder="Promokod"
              aria-label="Promokod"
            />
            <button
              type="button"
              disabled={!code || checking}
              onClick={() =>
                start(async () => {
                  const r = await checkPromo(courseId, code);
                  setQuote(r.ok ? { price: r.price } : { price, error: r.error });
                })
              }
              className="h-10 shrink-0 rounded-field border border-line-strong px-3 text-sm font-bold disabled:opacity-50"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Qo'llash"}
            </button>
          </div>
          {quote?.error && <p className="mt-1.5 text-xs font-semibold text-bad">{quote.error}</p>}
          {quote && !quote.error && (
            <p className="mt-1.5 text-xs font-semibold text-good">
              Promokod qabul qilindi: {money(final)}
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setPromoOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">
          <TicketPercent className="h-4 w-4" /> Promokodim bor
        </button>
      )}
      {state?.error && <p className="rounded-field bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">{state.error}</p>}
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {final === 0 ? 'Bepul boshlash' : pendingOrder ? `To'lovga o'tish, ${money(final)}` : `Sotib olish, ${money(final)}`}
      </button>
    </form>
  );
}
