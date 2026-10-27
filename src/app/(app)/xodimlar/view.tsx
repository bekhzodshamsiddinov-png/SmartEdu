'use client';
import { useState } from 'react';
import { Plus, Pencil, Phone, UserX, UserCheck, BriefcaseBusiness, ShieldOff, ShieldCheck } from 'lucide-react';
import type { Role } from '@/db/schema';
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { reset2fa, saveStaff, toggleStaff } from '@/app/actions/staff';
import { ROLE_LABELS } from '@/lib/roles';
import { money, phone, pct } from '@/lib/format';
import { fmtMonth, fmtShort } from '@/lib/dates';

type S = {
  id: number; branchId: number | null; fullName: string; phone: string; role: Role; position: string | null; baseSalary: number; teacherPercent: number; bonusRule: string | null; active: boolean; hiredAt: string | null; twoFactor: boolean;
  teach: { groups: number; students: number; lessons: number; late: number; missed: number; att_total: number; att_present: number } | null;
  admin: { received: number; calls: number; parent: number } | null;
  sales: { leads: number; paid: number; calls: number } | null;
  tasks: { open: number; overdue: number; done: number };
  reports: { c: number; last: string } | null;
};

const ROLE_HINT: Record<Role, string> = {
  rahbar: "Hamma bo'limlar",
  admin: "O'quvchilar, davomat, to'lovlar, lidlar",
  oqituvchi: "O'z guruhlari, davomat, baholar",
  support: "Biriktirilgan guruhlar, davomat",
  sotuv: "Lidlar, o'quvchilar, bitiruvchilar",
  marketing: 'Lidlar va hisobotlar',
  bugalter: "To'lovlar, moliya, solishtirma",
};

export function StaffView({ staff, meId, month, branches }: { staff: S[]; meId: number; month: string; branches: { id: number; name: string }[] }) {
  const [edit, setEdit] = useState<S | 'new' | null>(null);
  const fund = staff.filter((s) => s.active).reduce((a, s) => a + s.baseSalary, 0);
  return (
    <>
      <PageHeader
        title="Xodimlar"
        sub={`${staff.filter((s) => s.active).length} ta faol xodim, qat'iy oylik fondi ${money(fund)}`}
        actions={
          <Button onClick={() => setEdit('new')}>
            <Plus className="h-4 w-4" /> Xodim qo&apos;shish
          </Button>
        }
      />
      <p className="-mt-3 mb-5 text-[13px] text-fg-muted">Ko&apos;rsatkichlar {fmtMonth(month).toLowerCase()} bo&apos;yicha. Har bir xodim o&apos;z raqamlari uchun javob beradi.</p>
      {staff.length === 0 ? (
        <Card>
          <Empty icon={<BriefcaseBusiness className="h-5 w-5" />} title="Xodim yo'q" />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {staff.map((s) => (
            <Card key={s.id} className={cn('p-4', !s.active && 'opacity-55')}>
              <div className="flex items-start gap-3">
                <Avatar name={s.fullName} size={42} color={s.role === 'rahbar' ? '#0F2A2E' : '#1F4A50'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-extrabold">{s.fullName}</span>
                    {s.twoFactor && <ShieldCheck className="h-4 w-4 shrink-0 text-good" aria-label="Ikki bosqichli kirish yoqilgan" />}
                    <Badge tone={s.role === 'rahbar' ? 'brand' : 'neutral'}>{ROLE_LABELS[s.role]}</Badge>
                    {!s.active && <Badge tone="bad">Faol emas</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                    <a href={`tel:+${s.phone}`} className="inline-flex items-center gap-1 tnum hover:text-brand">
                      <Phone className="h-3 w-3" /> {phone(s.phone)}
                    </a>
                    {s.position && <span>{s.position}</span>}
                    {branches.length > 1 && <span>{s.role === 'rahbar' || !s.branchId ? 'Barcha filiallar' : branches.find((b) => b.id === s.branchId)?.name}</span>}
                    {s.baseSalary > 0 && <span>Oylik: {money(s.baseSalary)}</span>}
                    {s.teacherPercent > 0 && <span>Ulush: {s.teacherPercent}%</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(s)} aria-label="Tahrirlash">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {s.id !== meId && s.twoFactor && <Reset2fa id={s.id} name={s.fullName} />}
                  {s.id !== meId && (
                    <ActionButton variant="ghost" size="icon" action={() => toggleStaff(s.id)} confirm={s.active ? 'Xodim tizimga kira olmaydigan bo\'ladi. Davom etasizmi?' : undefined} title={s.active ? 'Faolsizlantirish' : 'Faollashtirish'}>
                      {s.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </ActionButton>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {s.teach && (
                  <>
                    <K label="Guruh / o'quvchi" value={`${s.teach.groups} / ${s.teach.students}`} />
                    <K label="Davomat" value={s.teach.att_total ? pct((s.teach.att_present / s.teach.att_total) * 100) : '—'} tone={s.teach.att_total && s.teach.att_present / s.teach.att_total < 0.8 ? 'warn' : undefined} />
                    <K label="Darslar" value={String(s.teach.lessons)} hint={s.teach.late || s.teach.missed ? `${s.teach.late} kech., ${s.teach.missed} o'tilmadi` : undefined} tone={s.teach.missed ? 'bad' : undefined} />
                  </>
                )}
                {s.admin && (
                  <>
                    <K label="Qabul qilgan to'lov" value={money(s.admin.received, false)} />
                    <K label="Qo'ng'iroqlar" value={String(s.admin.calls)} />
                    <K label="Ota-onaga hisobot" value={String(s.admin.parent)} />
                  </>
                )}
                {s.sales && (
                  <>
                    <K label="Lidlar" value={String(s.sales.leads)} />
                    <K label="Sotildi" value={String(s.sales.paid)} hint={s.sales.leads ? pct((s.sales.paid / s.sales.leads) * 100) : undefined} />
                    <K label="Qo'ng'iroqlar" value={String(s.sales.calls)} />
                  </>
                )}
                <K label="Vazifalar" value={`${s.tasks.done} bajarildi`} hint={s.tasks.overdue ? `${s.tasks.overdue} ta kechikkan` : `${s.tasks.open} ta ochiq`} tone={s.tasks.overdue ? 'bad' : undefined} />
                {!s.teach && !s.admin && !s.sales && <K label="Hisobotlar" value={String(s.reports?.c ?? 0)} hint={s.reports ? `oxirgisi ${fmtShort(s.reports.last)}` : "yozilmagan"} />}
              </div>
              {(s.teach || s.admin || s.sales) && (
                <div className="mt-2 text-xs text-fg-muted">
                  Kunlik hisobotlar: <b className="text-fg">{s.reports?.c ?? 0}</b>
                  {s.reports && `, oxirgisi ${fmtShort(s.reports.last)}`}
                  {s.bonusRule && <span className="block">Bonus: {s.bonusRule}</span>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi xodim' : 'Xodimni tahrirlash'}>
        {edit && <StaffForm s={edit === 'new' ? null : edit} branches={branches} onDone={() => setEdit(null)} />}
      </Modal>
    </>
  );
}

function K({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <div className="truncate text-2xs font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-0.5 truncate text-sm font-extrabold tnum', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{value}</div>
      {hint && <div className="truncate text-2xs text-fg-muted">{hint}</div>}
    </div>
  );
}

function StaffForm({ s, branches, onDone }: { s: S | null; branches: { id: number; name: string }[]; onDone: () => void }) {
  const [role, setRole] = useState<Role>(s?.role ?? 'oqituvchi');
  return (
    <ActionForm action={saveStaff.bind(null, s?.id ?? null)} onDone={onDone} onCancel={onDone}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ism-familiya">
          <input name="fullName" defaultValue={s?.fullName} className="field" required />
        </Field>
        <Field label="Telefon (login)">
          <input name="phone" type="tel" defaultValue={s?.phone} className="field" placeholder="90 123 45 67" required />
        </Field>
      </div>
      <Field label="Lavozim" hint={`Ko'radigan bo'limlari: ${ROLE_HINT[role]}`}>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="field">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lavozim nomi (ixtiyoriy)">
          <input name="position" defaultValue={s?.position ?? ''} className="field" placeholder="Masalan: Katta o'qituvchi" />
        </Field>
        <Field label="Ishga kirgan sana">
          <input type="date" name="hiredAt" defaultValue={s?.hiredAt ?? ''} className="field" />
        </Field>
        <Field label="Qat'iy oylik (oklad)">
          <MoneyInput name="baseSalary" defaultValue={s?.baseSalary} />
        </Field>
        <Field label="Ulush, %" hint="Guruhlaridagi o'quvchilar to'lagan pulning necha foizi oylikka qo'shiladi">
          <input type="number" name="teacherPercent" min={0} max={80} defaultValue={s?.teacherPercent ?? 0} className="field" />
        </Field>
        <Field label={s ? 'Yangi parol' : 'Parol'} hint={s ? "O'zgartirmasangiz bo'sh qoldiring" : 'Kamida 8 belgi, harf va raqam'}>
          <input name="password" type="text" autoComplete="new-password" className="field" required={!s} minLength={8} />
        </Field>
      </div>
      {branches.length > 1 && role !== 'rahbar' && (
        <Field label="Filial" hint="Xodim faqat shu filial ma'lumotlarini ko'radi">
          <select name="branchId" defaultValue={s?.branchId ?? ''} className="field">
            <option value="">Barcha filiallar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Bonus qoidasi" hint="Masalan: har bir yangi o'quvchi uchun 50 000 so'm">
        <input name="bonusRule" defaultValue={s?.bonusRule ?? ''} className="field" />
      </Field>
      {(role === 'rahbar' || s?.role === 'rahbar') && (
        <Field label="Sizning parolingiz" hint="Rahbar hisobini yaratish yoki o'zgartirish xavfsizlik uchun parol bilan tasdiqlanadi">
          <input name="confirmPassword" type="password" autoComplete="current-password" className="field" />
        </Field>
      )}
    </ActionForm>
  );
}

function Reset2fa({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="2FA ni bekor qilish (telefon yo'qolsa)" aria-label="2FA ni bekor qilish">
        <ShieldOff className="h-4 w-4" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ikki bosqichli kirishni bekor qilish" size="sm">
        {open && (
          <ActionForm action={reset2fa.bind(null, id)} submitLabel="Bekor qilish" danger onDone={() => setOpen(false)} onCancel={() => setOpen(false)}>
            <p className="text-sm text-fg-muted">{name}: telefoni yo&apos;qolgan bo&apos;lsa, uning 2FA si o&apos;chiriladi va xodim qayta yoqadi. Barcha qurilmalardan chiqariladi.</p>
            <Field label="Sizning parolingiz">
              <input name="confirmPassword" type="password" autoComplete="current-password" className="field" required />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
