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
  category?: string; outcomes?: string | null; audience?: string | null;
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
      <Field label="Yo'nalish">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['ai', "Sun'iy intellekt"],
            ['youtube', 'YouTube'],
            ['boshqa', 'Boshqa'],
          ].map(([k, l]) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="category" value={k} defaultChecked={(c?.category ?? 'ai') === k} className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-field border border-line-strong text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong">{l}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Qisqa tavsif" hint="Kurs sahifasida nom ostida chiqadi">
        <input name="subtitle" defaultValue={c?.subtitle ?? ''} className="field" placeholder="Ishda va o'qishda AI dan foydalanishni 4 haftada o'rganing" />
      </Field>
      {!compact && (
        <>
          <Field label="Nimalarni o'rganadi" hint="Har bir natijani yangi qatorga yozing">
            <textarea name="outcomes" defaultValue={c?.outcomes ?? ''} rows={5} className="field" placeholder={"ChatGPT'da aniq prompt yozish\nAI yordamida taqdimot tayyorlash"} />
          </Field>
          <Field label="Kimlar uchun" hint="Har birini yangi qatorga yozing">
            <textarea name="audience" defaultValue={c?.audience ?? ''} rows={3} className="field" placeholder={"Talabalar va maktab o'quvchilari\nIshida vaqt tejamoqchi bo'lganlar"} />
          </Field>
          <Field label="Kurs haqida">
            <textarea name="description" defaultValue={c?.description ?? ''} rows={5} className="field" />
          </Field>
        </>
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
