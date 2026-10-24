'use client';
import { useActionState, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loginLearner, registerLearner } from '@/app/actions/academy';
import { cn } from '@/components/ui';

export function AuthForms({ next, initial }: { next: string; initial: 'kirish' | 'royxat' }) {
  const [tab, setTab] = useState(initial);
  const [lState, login, lPending] = useActionState(loginLearner, undefined);
  const [rState, register, rPending] = useActionState(registerLearner, undefined);
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-lift sm:p-8">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{tab === 'kirish' ? 'Kabinetga kirish' : "Ro'yxatdan o'tish"}</h1>
      <p className="mt-1 text-sm text-fg-muted">{tab === 'kirish' ? 'Telefon raqamingiz va parolingiz bilan kiring.' : "Kurslarni sotib olish va darslarni ko'rish uchun hisob oching."}</p>
      <div className="mt-6 grid grid-cols-2 rounded-field bg-canvas p-1" role="tablist">
        {(['kirish', 'royxat'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-9 rounded-[7px] text-sm font-bold', tab === t ? 'bg-white shadow-lift' : 'text-fg-muted')}>
            {t === 'kirish' ? 'Kirish' : "Ro'yxatdan o'tish"}
          </button>
        ))}
      </div>
      {tab === 'kirish' ? (
        <form action={login} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="label">Telefon raqam</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" className="field h-12 text-base" required />
          </label>
          <label className="block">
            <span className="label">Parol</span>
            <input name="password" type="password" autoComplete="current-password" className="field h-12 text-base" required />
          </label>
          {lState?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-semibold text-bad">{lState.error}</p>}
          <button disabled={lPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong disabled:opacity-60">
            {lPending && <Loader2 className="h-4 w-4 animate-spin" />} Kirish
          </button>
          <p className="text-center text-xs text-fg-muted">Parolni unutgan bo&apos;lsangiz, bizga Telegram orqali yozing.</p>
        </form>
      ) : (
        <form action={register} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="label">Ism-familiya</span>
            <input name="fullName" autoComplete="name" className="field h-12 text-base" required />
          </label>
          <label className="block">
            <span className="label">Telefon raqam</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" className="field h-12 text-base" required />
          </label>
          <label className="block">
            <span className="label">Parol o&apos;ylab toping</span>
            <input name="password" type="password" minLength={8} autoComplete="new-password" className="field h-12 text-base" required />
            <span className="mt-1 block text-xs text-fg-muted">Kamida 8 belgi, harf va raqam aralash.</span>
          </label>
          {rState?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-semibold text-bad">{rState.error}</p>}
          <button disabled={rPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong disabled:opacity-60">
            {rPending && <Loader2 className="h-4 w-4 animate-spin" />} Hisob ochish
          </button>
        </form>
      )}
    </div>
  );
}
