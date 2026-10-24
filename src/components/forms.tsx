'use client';
import { useMemo, useState } from 'react';
import { ActionForm } from './action-form';
import { MoneyInput } from './money-input';
import { Field } from './ui';
import { addPayment } from '@/app/actions/payments';
import { createStudent, updateStudent, changeStatus } from '@/app/actions/students';
import { LEAD_SOURCES, LEAVE_REASONS, PAY_METHODS, RETURN_RESULTS } from '@/lib/constants';
import { money } from '@/lib/format';

export type GroupOpt = { id: number; name: string; course: string; fee: number };
export type StudentOpt = { id: number; name: string; phone?: string | null; debt?: number; fee?: number; enrollments?: { id: number; label: string }[] };

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export function GroupSelect({ groups, name = 'groupId', defaultValue, onChange, optional = true }: { groups: GroupOpt[]; name?: string; defaultValue?: number | null; onChange?: (g: GroupOpt | undefined) => void; optional?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ''} className="field" onChange={(e) => onChange?.(groups.find((g) => g.id === Number(e.target.value)))} required={!optional}>
      {optional && <option value="">Hozircha guruhsiz</option>}
      {!optional && <option value="">Guruhni tanlang</option>}
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.course})
        </option>
      ))}
    </select>
  );
}

export function StudentFields({ s }: { s?: Partial<Record<string, string | number | null>> }) {
  return (
    <>
      <Field label="Ism-familiya">
        <input name="fullName" defaultValue={(s?.fullName as string) ?? ''} className="field" required placeholder="Masalan: Azizbek Karimov" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <input name="phone" type="tel" defaultValue={(s?.phone as string) ?? ''} className="field" placeholder="90 123 45 67" />
        </Field>
        <Field label="Tug'ilgan yili">
          <input name="birthYear" type="number" min={1950} max={2025} defaultValue={(s?.birthYear as number) ?? ''} className="field" />
        </Field>
        <Field label="Ota-onasi ismi">
          <input name="parentName" defaultValue={(s?.parentName as string) ?? ''} className="field" />
        </Field>
        <Field label="Ota-onasi telefoni">
          <input name="parentPhone" type="tel" defaultValue={(s?.parentPhone as string) ?? ''} className="field" placeholder="90 123 45 67" />
        </Field>
        <Field label="Maktab / o'qish joyi">
          <input name="school" defaultValue={(s?.school as string) ?? ''} className="field" />
        </Field>
        <Field label="Qayerdan bildi">
          <select name="source" defaultValue={(s?.source as string) ?? ''} className="field">
            <option value="">Tanlang</option>
            {LEAD_SOURCES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Manzil">
        <input name="address" defaultValue={(s?.address as string) ?? ''} className="field" />
      </Field>
      <Field label="Izoh">
        <textarea name="note" defaultValue={(s?.note as string) ?? ''} className="field" rows={2} />
      </Field>
    </>
  );
}

export function NewStudentForm({ groups, onDone, onCancel, lead }: { groups: GroupOpt[]; onDone?: () => void; onCancel?: () => void; lead?: { id: number; fullName: string; phone: string; source: string } }) {
  const [g, setG] = useState<GroupOpt | undefined>();
  return (
    <ActionForm action={createStudent} onDone={onDone} onCancel={onCancel} submitLabel="O'quvchini qo'shish">
      {lead && <input type="hidden" name="leadId" value={lead.id} />}
      <StudentFields s={lead ? { fullName: lead.fullName, phone: lead.phone, source: lead.source } : undefined} />
      <div className="rounded-xl border border-line bg-canvas/70 p-4">
        <div className="mb-3 text-sm font-bold">Guruhga yozish</div>
        <div className="space-y-4">
          <Field label="Guruh">
            <GroupSelect groups={groups} onChange={setG} />
          </Field>
          {g && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Oylik to'lov" hint={`Yo'nalish narxi: ${money(g.fee)}`}>
                <MoneyInput key={g.id} name="monthlyFee" defaultValue={g.fee} />
              </Field>
              <Field label="Boshlagan sana">
                <input type="date" name="startDate" defaultValue={todayStr()} className="field" />
              </Field>
            </div>
          )}
        </div>
      </div>
      <input type="hidden" name="joinedAt" value={todayStr()} />
    </ActionForm>
  );
}

export function EditStudentForm({ s, onDone, onCancel }: { s: Record<string, string | number | null>; onDone?: () => void; onCancel?: () => void }) {
  return (
    <ActionForm action={updateStudent.bind(null, Number(s.id))} onDone={onDone} onCancel={onCancel}>
      <StudentFields s={s} />
      <Field label="Qo'shilgan sana">
        <input type="date" name="joinedAt" defaultValue={(s.joinedAt as string) ?? ''} className="field" />
      </Field>
    </ActionForm>
  );
}

export function PaymentForm({
  students,
  fixedStudent,
  onDone,
  onCancel,
}: {
  students: StudentOpt[];
  fixedStudent?: StudentOpt;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [sid, setSid] = useState<number | null>(fixedStudent?.id ?? null);
  const [q, setQ] = useState('');
  const s = fixedStudent ?? students.find((x) => x.id === sid);
  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    const d = q.replace(/\D/g, '');
    return students.filter((x) => !t || x.name.toLowerCase().includes(t) || (d.length >= 3 && x.phone?.includes(d))).slice(0, 8);
  }, [q, students]);
  const month = todayStr().slice(0, 7);
  return (
    <ActionForm action={addPayment} onDone={onDone} onCancel={onCancel} submitLabel="To'lovni qabul qilish">
      {s ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/70 px-4 py-3">
          <div>
            <div className="text-sm font-bold">{s.name}</div>
            <div className="text-xs text-fg-muted">
              {s.debt ? <span className="font-semibold text-bad">Qarz: {money(s.debt)}</span> : "Qarzi yo'q"}
              {s.fee ? `, oylik ${money(s.fee)}` : ''}
            </div>
          </div>
          {!fixedStudent && (
            <button type="button" onClick={() => setSid(null)} className="text-[13px] font-bold text-brand">
              O&apos;zgartirish
            </button>
          )}
          <input type="hidden" name="studentId" value={s.id} />
        </div>
      ) : (
        <Field label="O'quvchi">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="field" placeholder="Ism yoki telefon bo'yicha qidiring" autoFocus />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
            {filtered.length === 0 && <div className="px-4 py-3 text-sm text-fg-muted">Topilmadi</div>}
            {filtered.map((x) => (
              <button type="button" key={x.id} onClick={() => setSid(x.id)} className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-canvas">
                <span className="text-sm font-semibold">{x.name}</span>
                {x.debt ? <span className="text-xs font-semibold text-bad tnum">{money(x.debt)}</span> : <span className="text-xs text-fg-faint">qarz yo&apos;q</span>}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Summa">
          <MoneyInput key={s?.id ?? 0} name="amount" defaultValue={s?.debt && s.debt > 0 ? s.debt : s?.fee} required />
        </Field>
        <Field label="Qaysi oy uchun">
          <input type="month" name="forMonth" defaultValue={month} className="field" />
        </Field>
      </div>
      <Field label="To'lov usuli">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PAY_METHODS.map((m, i) => (
            <label key={m.key} className="cursor-pointer">
              <input type="radio" name="method" value={m.key} defaultChecked={i === 0} className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-field border border-line-strong px-2 text-center text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                {m.label.replace(' (terminal)', '').replace(" o'tkazmasi", '')}
              </span>
            </label>
          ))}
        </div>
      </Field>
      {s?.enrollments && s.enrollments.length > 1 && (
        <Field label="Qaysi guruh uchun">
          <select name="enrollmentId" className="field">
            {s.enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sana">
          <input type="date" name="paidAt" defaultValue={todayStr()} className="field" />
        </Field>
        <Field label="Izoh">
          <input name="note" className="field" placeholder="Chek raqami va h.k." />
        </Field>
      </div>
    </ActionForm>
  );
}

export function StatusForm({ studentId, current, groups, onDone, onCancel }: { studentId: number; current: string; groups: GroupOpt[]; onDone?: () => void; onCancel?: () => void }) {
  const [status, setStatus] = useState(current === 'ketgan' || current === 'bitirgan' || current === 'muzlatilgan' ? 'faol' : 'ketgan');
  const [reason, setReason] = useState('');
  const fix = LEAVE_REASONS.find((r) => r.label === reason)?.fix;
  const opts = [
    { v: 'ketgan', l: 'Ketdi' },
    { v: 'bitirgan', l: 'Bitirdi' },
    { v: 'muzlatilgan', l: 'Vaqtincha to\'xtatdi' },
    { v: 'xavf', l: 'Xavf ostida' },
    { v: 'faol', l: 'Faol (qaytdi)' },
  ].filter((o) => o.v !== current);
  return (
    <ActionForm action={changeStatus.bind(null, studentId)} onDone={onDone} onCancel={onCancel} danger={status === 'ketgan'} submitLabel="Holatni saqlash">
      <Field label="Yangi holat">
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => (
            <label key={o.v} className="cursor-pointer">
              <input type="radio" name="status" value={o.v} checked={status === o.v} onChange={() => setStatus(o.v)} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                {o.l}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Sana">
        <input type="date" name="date" defaultValue={todayStr()} className="field" />
      </Field>
      {status === 'ketgan' && (
        <>
          <Field label="Ketish sababi">
            <select name="leftReason" value={reason} onChange={(e) => setReason(e.target.value)} className="field" required>
              <option value="">Sababni tanlang</option>
              {LEAVE_REASONS.map((r) => (
                <option key={r.code}>{r.label}</option>
              ))}
            </select>
          </Field>
          {fix && <p className="rounded-field bg-info-soft px-3 py-2.5 text-[13px] text-info">Qaytarish uchun: {fix}.</p>}
          <Field label="Qaytarish uchun nima qilindi">
            <textarea name="returnAttempt" rows={2} className="field" placeholder="Masalan: ota-onasi bilan gaplashildi, bo'lib to'lash taklif qilindi" />
          </Field>
          <Field label="Natija">
            <select name="returnResult" className="field" defaultValue="">
              <option value="">Hali urinish qilinmadi</option>
              {RETURN_RESULTS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {status === 'faol' && (current === 'ketgan' || current === 'muzlatilgan' || current === 'bitirgan') && (
        <Field label="Qaysi guruhga qaytadi">
          <GroupSelect groups={groups} />
        </Field>
      )}
    </ActionForm>
  );
}
