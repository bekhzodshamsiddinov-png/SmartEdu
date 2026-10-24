'use client';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { login } from '@/app/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
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
