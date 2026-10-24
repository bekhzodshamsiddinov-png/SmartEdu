'use client';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { setup } from '@/app/actions/auth';

export function SetupForm({ needCode }: { needCode: boolean }) {
  const [state, action, pending] = useActionState(setup, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      {needCode && (
        <label className="block">
          <span className="label">Sozlash kodi</span>
          <input name="code" autoComplete="off" className="field h-11 tnum tracking-widest" required />
          <span className="mt-1 block text-xs text-fg-muted">Kod tizimni o&apos;rnatgan odam tomonidan beriladi.</span>
        </label>
      )}
      <label className="block">
        <span className="label">O&apos;quv markaz nomi</span>
        <input name="centerName" defaultValue="United IT Clubs" className="field h-11" />
      </label>
      <label className="block">
        <span className="label">Ism-familiyangiz</span>
        <input name="fullName" placeholder="Bekhzod Shamsiddinov" className="field h-11" required />
      </label>
      <label className="block">
        <span className="label">Telefon raqam (login)</span>
        <input name="phone" type="tel" inputMode="tel" placeholder="90 123 45 67" className="field h-11" required />
      </label>
      <label className="block">
        <span className="label">Parol</span>
        <input name="password" type="password" minLength={6} autoComplete="new-password" className="field h-11" required />
        <span className="mt-1 block text-xs text-fg-muted">Kamida 6 belgi.</span>
      </label>
      {state?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">{state.error}</p>}
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-bold text-white hover:bg-brand-strong disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Hisobni yaratish
      </button>
    </form>
  );
}
