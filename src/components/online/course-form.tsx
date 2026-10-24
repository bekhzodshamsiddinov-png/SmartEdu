'use client';
import { useRouter } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { Field } from '@/components/ui';
import { saveOnlineCourse } from '@/app/actions/online';
import { LEVELS } from '@/lib/constants';

const COLORS = ['#008A70', '#3D6FD1', '#C2862A', '#B5487A', '#7A5BC7'];

export type CourseData = {
  id: number; title: string; slug: string; subtitle: string | null; description: string | null; level: string; price: number;
  oldPrice: number | null; coverUrl: string | null; color: string; status: string; accessDays: number | null;
};

export function CourseForm({ c, onDone, compact }: { c?: CourseData; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  return (
    <ActionForm
      action={saveOnlineCourse.bind(null, c?.id ?? null)}
      submitLabel={c ? "O'zgarishlarni saqlash" : 'Kursni yaratish'}
      onCancel={onDone}
      onDone={(r) => {
        if (!c && r.ok && r.id) {
          router.push(`/onlayn/kurslar/${r.id}`);
          return;
        }
        onDone?.();
      }}
    >
      <Field label="Kurs nomi">
        <input name="title" defaultValue={c?.title} className="field" placeholder="Masalan: ChatGPT bilan ishlash. 0 dan professionalgacha" required />
      </Field>
      <Field label="Qisqa tavsif" hint="Kurs sahifasida nom ostida chiqadi">
        <input name="subtitle" defaultValue={c?.subtitle ?? ''} className="field" placeholder="Ishda va o'qishda AI dan foydalanishni 4 haftada o'rganing" />
      </Field>
      {!compact && (
        <Field label="To'liq tavsif" hint="Kim uchun, nimani o'rganadi, natija">
          <textarea name="description" defaultValue={c?.description ?? ''} rows={5} className="field" />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Narx">
          <MoneyInput name="price" defaultValue={c?.price} required />
        </Field>
        <Field label="Eski narx (chegirma ko'rsatish uchun)">
          <MoneyInput name="oldPrice" defaultValue={c?.oldPrice} />
        </Field>
        <Field label="Daraja">
          <select name="level" defaultValue={c?.level ?? 'boshlangich'} className="field">
            {Object.entries(LEVELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kirish muddati (kun)" hint="Bo'sh qoldirsangiz umrbod">
          <input type="number" name="accessDays" min={1} defaultValue={c?.accessDays ?? ''} className="field" placeholder="Umrbod" />
        </Field>
      </div>
      {!compact && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Havola (slug)" hint="Kurs sahifasi manzili uchun">
              <input name="slug" defaultValue={c?.slug ?? ''} className="field" placeholder="chatgpt-bilan-ishlash" />
            </Field>
            <Field label="Muqova rasmi (URL)">
              <input name="coverUrl" defaultValue={c?.coverUrl ?? ''} className="field" placeholder="https://" />
            </Field>
          </div>
        </>
      )}
      <Field label="Rang">
        <div className="flex gap-2">
          {COLORS.map((col, i) => (
            <label key={col} className="cursor-pointer">
              <input type="radio" name="color" value={col} defaultChecked={c ? c.color === col : i === 0} className="peer sr-only" />
              <span className="block h-8 w-8 rounded-lg ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand" style={{ background: col }} />
            </label>
          ))}
        </div>
      </Field>
      <input type="hidden" name="status" value={c?.status ?? 'qoralama'} />
    </ActionForm>
  );
}
