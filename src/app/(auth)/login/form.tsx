'use client';
import { useActionState, useEffect, useRef } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { login, verifyLoginCode } from '@/app/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  if (state?.step === 'code') return <CodeForm />;
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block">
        <span className="label">Telefon raqam</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="90 123 45 67" className="field h-12 text-base" required />
      </label>
      <label className="block">
        <span className="label">Parol</span>
        <input name="password" type="password" autoComplete="current-password" className="field h-12 text-base" required />
      </label>
      {state?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">{state.error}</p>}
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-bold text-white hover:bg-brand-strong disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Kirish
      </button>
      <p className="pt-2 text-center text-xs text-fg-muted">Parolni unutdingizmi? Rahbar uni Xodimlar bo&apos;limida yangilaydi.</p>
    </form>
  );
}

function CodeForm() {
  const [state, action, pending] = useActionState(verifyLoginCode, undefined);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [state]);
  const expired = state?.error && state.step !== 'code';
  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-strong">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <span>Hisobingiz ikki bosqichli himoyada. Telefoningizdagi Authenticator ilovasidan 6 xonali kodni kiriting.</span>
      </div>
      <label className="block">
        <span className="label">Tasdiqlash kodi</span>
        <input
          ref={ref}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          maxLength={9}
          className="field h-12 text-center font-mono text-xl tracking-[0.3em]"
          required
        />
      </label>
      {state?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">{state.error}</p>}
      {expired ? (
        <a href="/login" className="flex h-12 w-full items-center justify-center rounded-field bg-ink text-[15px] font-bold text-white">
          Qaytadan kirish
        </a>
      ) : (
        <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-bold text-white hover:bg-brand-strong disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Tasdiqlash
        </button>
      )}
      <p className="pt-1 text-center text-xs text-fg-muted">Telefon yo&apos;qolgan bo&apos;lsa, zaxira kodlardan birini kiriting (masalan ABCD-EFGH).</p>
    </form>
  );
}
