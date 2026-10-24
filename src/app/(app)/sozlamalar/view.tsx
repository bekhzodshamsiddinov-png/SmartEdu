'use client';
import { Download, Database, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, Field } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { saveSettings, changeMyPassword } from '@/app/actions/staff';
import { PageHeader, buttonClass } from '@/components/ui';
import { num } from '@/lib/format';

const LABELS: Record<string, string> = { students: "O'quvchilar", payments: "To'lovlar", attendance: 'Davomat yozuvlari', leads: 'Lidlar', transactions: 'Kirim-chiqim', users: 'Xodimlar' };
const CSV = [
  { t: 'students', l: "O'quvchilar" },
  { t: 'payments', l: "To'lovlar" },
  { t: 'transactions', l: 'Kirim-chiqim' },
  { t: 'attendance', l: 'Davomat' },
  { t: 'leads', l: 'Lidlar' },
];

export function SettingsView({ s, counts }: { s: { centerName: string; phone: string | null; address: string | null; paymentDueDay: number; salaryDay: number; reservePercent: number }; counts: Record<string, number> }) {
  return (
    <>
      <PageHeader title="Sozlamalar" sub="Markaz ma'lumotlari, to'lov qoidalari va ma'lumotlar zaxirasi" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Markaz va qoidalar" />
          <div className="px-5 pb-5">
            <ActionForm action={saveSettings}>
              <Field label="Markaz nomi">
                <input name="centerName" defaultValue={s.centerName} className="field" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefon">
                  <input name="phone" defaultValue={s.phone ?? ''} className="field" />
                </Field>
                <Field label="Manzil">
                  <input name="address" defaultValue={s.address ?? ''} className="field" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="To'lov muddati" hint="Har oyning 1-dan shu sanagacha">
                  <input type="number" name="paymentDueDay" min={1} max={28} defaultValue={s.paymentDueDay} className="field" />
                </Field>
                <Field label="Oylik berish sanasi">
                  <input type="number" name="salaryDay" min={1} max={28} defaultValue={s.salaryDay} className="field" />
                </Field>
                <Field label="Zaxira, %" hint="Kirimdan zaxiraga">
                  <input type="number" name="reservePercent" min={0} max={50} defaultValue={s.reservePercent} className="field" />
                </Field>
              </div>
            </ActionForm>
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Ma'lumotlar sizniki" sub="Barcha yozuvlar o'zingizning Postgres bazangizda saqlanadi" />
            <div className="px-5 pb-5">
              <div className="mb-4 grid grid-cols-3 gap-2">
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
                    <div className="text-2xs font-semibold text-fg-muted">{LABELS[k] ?? k}</div>
                    <div className="text-[15px] font-extrabold tnum">{num(v)}</div>
                  </div>
                ))}
              </div>
              <a href="/api/export" className={buttonClass('primary', 'md', 'w-full')}>
                <Database className="h-4 w-4" /> To&apos;liq zaxira nusxasini yuklab olish (JSON)
              </a>
              <div className="mt-3 flex flex-wrap gap-2">
                {CSV.map((c) => (
                  <a key={c.t} href={`/api/export?table=${c.t}`} className={buttonClass('secondary', 'sm')}>
                    <Download className="h-3.5 w-3.5" /> {c.l}
                  </a>
                ))}
              </div>
              <p className="mt-3 text-xs text-fg-muted">Zaxirani har oy yuklab olib, alohida joyda saqlang. CSV fayllar Excelda ochiladi.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Parolni o'zgartirish" />
            <div className="px-5 pb-5">
              <ActionForm action={changeMyPassword} submitLabel="Parolni yangilash" resetOnSuccess>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Joriy parol">
                    <input type="password" name="current" autoComplete="current-password" className="field" required />
                  </Field>
                  <Field label="Yangi parol">
                    <input type="password" name="next" autoComplete="new-password" minLength={6} className="field" required />
                  </Field>
                </div>
              </ActionForm>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> Parollar shifrlangan holda saqlanadi.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
