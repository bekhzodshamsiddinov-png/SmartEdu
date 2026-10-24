'use client';
import { Download, Database, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, Field } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { saveSettings, changeMyPassword, saveAcademySettings } from '@/app/actions/staff';
import { saveBranch, toggleBranch } from '@/app/actions/branch';
import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Power } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-form';
import { PageHeader, buttonClass } from '@/components/ui';
import { num } from '@/lib/format';

const LABELS: Record<string, string> = { students: "O'quvchilar", payments: "To'lovlar", attendance: 'Davomat yozuvlari', leads: 'Lidlar', transactions: 'Kirim-chiqim', users: 'Xodimlar' };
const CSV = [
  { t: 'students', l: "O'quvchilar" },
  { t: 'payments', l: "To'lovlar" },
  { t: 'transactions', l: 'Kirim-chiqim' },
  { t: 'attendance', l: 'Davomat' },
  { t: 'leads', l: 'Lidlar' },
  { t: 'course_orders', l: 'Onlayn sotuvlar' },
  { t: 'learners', l: "Onlayn o'quvchilar" },
];

type Br = { id: number; name: string; address: string | null; phone: string | null; active: boolean; students: number; groups: number };

type Academy = { payCard: string | null; payCardHolder: string | null; telegram: string | null; instagram: string | null; academyTagline: string | null };

export function SettingsView({ s, counts, branches, academy, integrations }: { academy: Academy; integrations: { click: boolean; payme: boolean; telegram: boolean }; branches: Br[]; s: { centerName: string; phone: string | null; address: string | null; paymentDueDay: number; salaryDay: number; reservePercent: number }; counts: Record<string, number> }) {
  return (
    <>
      <PageHeader title="Sozlamalar" sub="Markaz ma'lumotlari, to'lov qoidalari va ma'lumotlar zaxirasi" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
        <AcademyCard a={academy} integrations={integrations} />
        <BranchesCard branches={branches} />
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
        </div>
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

function BranchesCard({ branches }: { branches: Br[] }) {
  const [edit, setEdit] = useState<Br | 'new' | null>(null);
  return (
    <Card>
      <CardHeader
        title="Filiallar"
        sub="Har bir filial o'z guruhlari, o'quvchilari va xarajatlari bilan alohida hisoblanadi"
        action={
          <Button size="sm" variant="secondary" onClick={() => setEdit('new')}>
            <Plus className="h-4 w-4" /> Filial
          </Button>
        }
      />
      <ul className="divide-y divide-line border-t border-line">
        {branches.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-bold">
                {b.name}
                {!b.active && <Badge>Yopilgan</Badge>}
              </div>
              <div className="truncate text-xs text-fg-muted">
                {b.groups} guruh, {b.students} o&apos;quvchi{b.address ? `, ${b.address}` : ''}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEdit(b)} aria-label="Tahrirlash">
              <Pencil className="h-4 w-4" />
            </Button>
            <ActionButton variant="ghost" size="icon" action={() => toggleBranch(b.id)} confirm={b.active ? 'Filial yopilsinmi? Ma\'lumotlari saqlanib qoladi.' : undefined} title={b.active ? 'Yopish' : 'Qayta ochish'}>
              <Power className="h-4 w-4" />
            </ActionButton>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi filial' : 'Filialni tahrirlash'} size="sm">
        {edit && (
          <ActionForm action={saveBranch.bind(null, edit === 'new' ? null : edit.id)} onDone={() => setEdit(null)} onCancel={() => setEdit(null)}>
            <Field label="Nomi">
              <input name="name" defaultValue={edit === 'new' ? '' : edit.name} className="field" placeholder="Masalan: Davlatobod filiali" required />
            </Field>
            <Field label="Manzil">
              <input name="address" defaultValue={edit === 'new' ? '' : edit.address ?? ''} className="field" />
            </Field>
            <Field label="Telefon">
              <input name="phone" defaultValue={edit === 'new' ? '' : edit.phone ?? ''} className="field" />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </Card>
  );
}

function AcademyCard({ a, integrations }: { a: Academy; integrations: { click: boolean; payme: boolean; telegram: boolean } }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const rows = [
    { k: 'Click', on: integrations.click, hint: `Prepare va Complete URL: ${origin}/api/click`, env: 'CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY' },
    { k: 'Payme', on: integrations.payme, hint: `Endpoint: ${origin}/api/payme, hisob maydoni: order_id`, env: 'PAYME_MERCHANT_ID, PAYME_KEY' },
    { k: 'Telegram xabarlar', on: integrations.telegram, hint: 'Yangi buyurtma va to\'lov haqida xabar', env: 'TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID' },
  ];
  return (
    <Card>
      <CardHeader title="Akademiya sayti va to'lov" sub="Onlayn kurslar sotiladigan sayt: /akademiya" action={<a href="/akademiya" target="_blank" rel="noreferrer" className="text-[13px] font-bold text-brand hover:underline">Saytni ochish</a>} />
      <div className="space-y-5 px-5 pb-5">
        <ActionForm action={saveAcademySettings}>
          <Field label="Sayt shiori" hint="Bosh sahifada sarlavha ostida chiqadi">
            <input name="academyTagline" defaultValue={a.academyTagline ?? ''} className="field" placeholder="Qisqa video darslar va amaliy topshiriqlar" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Karta raqami" hint="Karta orqali to'lov uchun ko'rsatiladi">
              <input name="payCard" defaultValue={a.payCard ?? ''} inputMode="numeric" className="field font-mono tracking-wider" placeholder="8600 0000 0000 0000" />
            </Field>
            <Field label="Karta egasi">
              <input name="payCardHolder" defaultValue={a.payCardHolder ?? ''} className="field" />
            </Field>
            <Field label="Telegram">
              <input name="telegram" defaultValue={a.telegram ?? ''} className="field" placeholder="@unitedit" />
            </Field>
            <Field label="Instagram">
              <input name="instagram" defaultValue={a.instagram ?? ''} className="field" placeholder="@unitedit" />
            </Field>
          </div>
        </ActionForm>
        <div className="rounded-xl border border-line">
          {rows.map((r) => (
            <div key={r.k} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
              <Badge tone={r.on ? 'good' : 'neutral'}>{r.on ? 'Ulangan' : 'Ulanmagan'}</Badge>
              <div className="min-w-0 text-[13px]">
                <div className="font-bold">{r.k}</div>
                <div className="break-all text-fg-muted">{r.on ? r.hint : `Vercel'da ${r.env} o'zgaruvchilarini qo'shing. ${r.hint}`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
