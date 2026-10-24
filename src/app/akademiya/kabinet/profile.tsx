'use client';
import { useActionState, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { updateProfile } from '@/app/actions/academy';

export function ProfileForm({ name, email, telegram }: { name: string; email: string; telegram: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state && !state.error) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">Ism-familiya</span>
        <input name="fullName" defaultValue={name} className="field" required />
      </label>
      <label className="block">
        <span className="label">Telegram</span>
        <input name="telegram" defaultValue={telegram} className="field" placeholder="@username" />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" defaultValue={email} className="field" />
      </label>
      <div />
      <label className="block">
        <span className="label">Joriy parol</span>
        <input name="current" type="password" autoComplete="current-password" className="field" placeholder="Faqat parolni o'zgartirsangiz" />
      </label>
      <label className="block">
        <span className="label">Yangi parol</span>
        <input name="next" type="password" autoComplete="new-password" minLength={8} className="field" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-field bg-ink px-5 text-sm font-bold text-white disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
        </button>
        {state?.error && <span className="text-sm font-semibold text-bad">{state.error}</span>}
        {saved && <span className="text-sm font-semibold text-good">Saqlandi</span>}
      </div>
    </form>
  );
}
