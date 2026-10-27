'use client';
import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { submitApplication } from '@/app/actions/apply';

export function ApplyForm({ source, courses, branches, course, branch }: { source: string; courses: { id: number; name: string }[]; branches: { id: number; name: string }[]; course: number | null; branch: number | null }) {
  const [state, action, pending] = useActionState(submitApplication, undefined);
  if (state?.ok)
    return (
      <div className="mt-6 rounded-xl bg-good-soft p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-good" />
        <p className="mt-2 font-bold text-good">Arizangiz qabul qilindi!</p>
        <p className="mt-1 text-sm text-fg-muted">Tez orada siz bilan bog&apos;lanamiz.</p>
      </div>
    );
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="source" value={source} />
      {/* Bot tuzog'i: odam ko'rmaydi */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sayt <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="block">
        <span className="label">Ism-familiya</span>
        <input name="fullName" className="field h-12 text-base" maxLength={80} autoComplete="name" required />
      </label>
      <label className="block">
        <span className="label">Telefon raqam</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" className="field h-12 text-base" required />
      </label>
      {courses.length > 0 && (
        <label className="block">
          <span className="label">Qaysi kurs qiziqtiradi</span>
          <select name="courseId" defaultValue={course ?? ''} className="field h-12 text-base">
            <option value="">Hali aniq emas</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {branches.length > 1 && (
        <label className="block">
          <span className="label">Filial</span>
          <select name="branchId" defaultValue={branch ?? ''} className="field h-12 text-base">
            <option value="">Farqi yo&apos;q</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="label">Izoh (ixtiyoriy)</span>
        <input name="note" className="field h-12 text-base" maxLength={300} placeholder="Masalan: farzandim uchun, 12 yosh" />
      </label>
      {state?.error && <p className="rounded-field bg-bad-soft px-3 py-2.5 text-sm font-semibold text-bad">{state.error}</p>}
      <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-field bg-brand text-[15px] font-extrabold text-white hover:bg-brand-strong disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Yuborish
      </button>
      <p className="text-center text-xs text-fg-muted">Ma&apos;lumotlaringiz faqat siz bilan bog&apos;lanish uchun ishlatiladi.</p>
    </form>
  );
}
