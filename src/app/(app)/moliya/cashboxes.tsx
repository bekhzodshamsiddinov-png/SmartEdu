'use client';
import { useState } from 'react';
import { ArrowRight, Check, Landmark, Pencil, Plus, Power, Send, Wallet, X } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { createTransfer, decideTransfer, saveCashbox, toggleCashbox } from '@/app/actions/cashbox';
import { money } from '@/lib/format';
import { fmtShort } from '@/lib/dates';

export type Box = { id: number; name: string; ownerId: number | null; owner: string | null; isMain: boolean; branchId: number | null; active: boolean; byMethod: Record<string, number>; total: number; pendingIn: number };
export type Transfer = { id: number; fromId: number; toId: number; from: string; to: string; method: string; amount: number; status: string; note: string | null; by: string | null; createdById: number | null; at: string };

export const METHOD_LABEL: Record<string, string> = { naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme', bank: 'Bank' };
const STATUS: Record<string, { l: string; tone: 'warn' | 'good' | 'bad' }> = {
  kutilmoqda: { l: 'Tasdiq kutilmoqda', tone: 'warn' },
  tasdiqlandi: { l: 'Qabul qilindi', tone: 'good' },
  rad_etildi: { l: 'Rad etildi', tone: 'bad' },
};

export function CashboxesTab({
  boxes,
  transfers,
  staff,
  branches,
  me,
}: {
  boxes: Box[];
  transfers: Transfer[];
  staff: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  me: { id: number; role: string };
}) {
  const [edit, setEdit] = useState<Box | 'new' | null>(null);
  const [send, setSend] = useState<{ fromId?: number } | null>(null);
  const isBoss = me.role === 'rahbar';
  const active = boxes.filter((b) => b.active);
  const total = active.reduce((s, b) => s + b.total, 0);
  const cash = active.reduce((s, b) => s + (b.byMethod.naqd ?? 0), 0);
  const pending = transfers.filter((t) => t.status === 'kutilmoqda');
  const canDecide = (t: Transfer) => {
    const to = boxes.find((b) => b.id === t.toId);
    if (me.role === 'rahbar') return true;
    if (t.createdById === me.id) return false;
    return to?.ownerId ? to.ownerId === me.id : me.role === 'bugalter';
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Barcha kassalarda" value={money(total)} />
        <MiniStat label="Shundan naqd" value={money(cash)} />
        <MiniStat label="Kassalar" value={String(active.length)} />
        <MiniStat label="Tasdiq kutayotgan" value={String(pending.length)} tone={pending.length ? 'warn' : undefined} />
      </div>

      {active.some((b) => Object.values(b.byMethod).some((v) => v < 0)) && (
        <div className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          <b>Ba&apos;zi kassalarda qoldiq manfiy.</b> Odatda bu kassalar ishga tushishidan oldingi xarajatlar sababli bo&apos;ladi. Haqiqiy qoldiqni bilsangiz,
          &quot;Kirim&quot; tugmasi orqali <b>&quot;Boshlang&apos;ich qoldiq&quot;</b> toifasida kiriting — u daromad hisobotlariga qo&apos;shilmaydi.
        </div>
      )}

      {pending.length > 0 && (
        <Card className="overflow-hidden border-warn/40">
          <CardHeader title="Tasdiqlash kerak" sub="Pul qo'lingizga tekshirib, keyin qabul qiling" />
          <ul className="divide-y divide-line border-t border-line">
            {pending.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {t.from} <ArrowRight className="h-3.5 w-3.5 text-fg-muted" /> {t.to}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {fmtShort(t.at)}, {METHOD_LABEL[t.method] ?? t.method}
                    {t.by && `, yubordi: ${t.by}`}
                    {t.note && `, ${t.note}`}
                  </div>
                </div>
                <div className="text-sm font-bold tnum">{money(t.amount)}</div>
                {canDecide(t) && (
                  <div className="flex gap-1.5">
                    <ActionButton variant="primary" action={() => decideTransfer(t.id, true)}>
                      <Check className="h-4 w-4" /> Qabul qildim
                    </ActionButton>
                    <ActionButton variant="ghost" action={() => decideTransfer(t.id, false)} confirm="O'tkazma rad etilsinmi? Pul yuboruvchi kassaga qaytadi.">
                      <X className="h-4 w-4" /> Rad
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Kassalar"
          sub="Har bir xodim qabul qilgan pul o'z kassasiga tushadi, keyin asosiy kassaga topshiriladi"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSend({})}>
                <Send className="h-4 w-4" /> O&apos;tkazma
              </Button>
              {isBoss && (
                <Button size="sm" onClick={() => setEdit('new')}>
                  <Plus className="h-4 w-4" /> Kassa
                </Button>
              )}
            </div>
          }
        />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
          {boxes.map((b) => (
            <div key={b.id} className={cn('rounded-xl border border-line p-4', !b.active && 'opacity-50')}>
              <div className="flex items-start gap-3">
                <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', b.isMain ? 'bg-ink text-white' : 'bg-brand-soft text-brand')}>
                  {b.isMain ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-bold">
                    {b.name}
                    {b.isMain && <Badge tone="brand">Asosiy</Badge>}
                    {!b.active && <Badge>Yopilgan</Badge>}
                  </div>
                  <div className="text-xs text-fg-muted">{b.owner ? `Mas'ul: ${b.owner}` : b.isMain ? 'Markaz kassasi' : "Mas'ul biriktirilmagan"}</div>
                </div>
                {isBoss && (
                  <div className="flex">
                    <Button size="icon" variant="ghost" onClick={() => setEdit(b)} aria-label="Tahrirlash">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!b.isMain && (
                      <ActionButton variant="ghost" size="icon" action={() => toggleCashbox(b.id)} title={b.active ? 'Yopish' : 'Ochish'} confirm={b.active && b.total !== 0 ? "Kassada pul bor. Avval asosiy kassaga o'tkazing. Baribir yopilsinmi?" : undefined}>
                        <Power className="h-4 w-4" />
                      </ActionButton>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xl font-extrabold tnum">{money(b.total)}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted tnum">
                {Object.entries(b.byMethod)
                  .filter(([, v]) => v !== 0)
                  .map(([k, v]) => (
                    <span key={k} className={v < 0 ? 'font-semibold text-bad' : ''}>
                      {METHOD_LABEL[k] ?? k}: {money(v)}
                    </span>
                  ))}
                {b.pendingIn > 0 && <span className="font-semibold text-warn">Kelmoqda: {money(b.pendingIn)}</span>}
              </div>
              {b.active && b.total > 0 && !b.isMain && (isBoss || me.role === 'bugalter' || b.ownerId === me.id) && (
                <Button size="sm" variant="soft" className="mt-3 w-full" onClick={() => setSend({ fromId: b.id })}>
                  <Send className="h-4 w-4" /> Asosiy kassaga topshirish
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="O'tkazmalar tarixi" sub="Oxirgi 50 ta" />
        {transfers.length === 0 ? (
          <p className="border-t border-line px-5 py-6 text-center text-sm text-fg-muted">Hali o&apos;tkazma bo&apos;lmagan</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <div className="w-14 text-xs text-fg-muted tnum">{fmtShort(t.at)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {t.from} <ArrowRight className="h-3.5 w-3.5 text-fg-muted" /> {t.to}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {METHOD_LABEL[t.method] ?? t.method}
                    {t.by && `, ${t.by}`}
                    {t.note && `, ${t.note}`}
                  </div>
                </div>
                <Badge tone={STATUS[t.status]?.tone}>{STATUS[t.status]?.l ?? t.status}</Badge>
                <div className="w-28 text-right font-bold tnum">{money(t.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi kassa' : 'Kassani tahrirlash'} size="sm">
        {edit && (
          <ActionForm action={saveCashbox.bind(null, edit === 'new' ? null : edit.id)} onDone={() => setEdit(null)} onCancel={() => setEdit(null)}>
            <Field label="Nomi">
              <input name="name" defaultValue={edit === 'new' ? '' : edit.name} className="field" placeholder="Masalan: Administrator kassasi" maxLength={60} required />
            </Field>
            <Field label="Mas'ul xodim" hint="Shu xodim qabul qilgan to'lovlar shu kassaga tushadi">
              <select name="ownerId" defaultValue={edit === 'new' ? '' : edit.ownerId ?? ''} className="field">
                <option value="">— Biriktirilmagan —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {branches.length > 1 && (
              <Field label="Filial">
                <select name="branchId" defaultValue={edit === 'new' ? '' : edit.branchId ?? ''} className="field">
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </ActionForm>
        )}
      </Modal>

      <Modal open={!!send} onClose={() => setSend(null)} title="Kassadan kassaga o'tkazma" sub={isBoss ? 'Rahbar yuborgan o\'tkazma darhol o\'tadi' : 'Qabul qiluvchi tasdiqlagach o\'tadi'} size="sm">
        {send && <TransferForm boxes={active} me={me} fromId={send.fromId} onDone={() => setSend(null)} />}
      </Modal>
    </div>
  );
}

export function TransferForm({ boxes, me, fromId, onDone }: { boxes: Box[]; me: { id: number; role: string }; fromId?: number; onDone: () => void }) {
  const mayFrom = boxes.filter((b) => me.role === 'rahbar' || me.role === 'bugalter' || b.ownerId === me.id);
  const [from, setFrom] = useState<number>(fromId ?? mayFrom[0]?.id ?? 0);
  const fb = boxes.find((b) => b.id === from);
  const methods = Object.entries(fb?.byMethod ?? {}).filter(([, v]) => v > 0);
  const [method, setMethod] = useState(methods[0]?.[0] ?? 'naqd');
  const main = boxes.find((b) => b.isMain);
  const avail = fb?.byMethod[method] ?? 0;
  return (
    <ActionForm action={createTransfer} onDone={onDone} onCancel={onDone} submitLabel="Yuborish">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qaysi kassadan">
          <select name="fromId" value={from} onChange={(e) => setFrom(Number(e.target.value))} className="field">
            {mayFrom.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Qaysi kassaga">
          <select name="toId" defaultValue={from === main?.id ? '' : main?.id} className="field" required>
            <option value="">Tanlang</option>
            {boxes
              .filter((b) => b.id !== from)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <Field label="Usul">
        <div className="flex flex-wrap gap-1.5">
          {(methods.length ? methods.map(([k]) => k) : ['naqd']).map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} className="peer sr-only" />
              <span className="inline-flex h-9 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                {METHOD_LABEL[k] ?? k}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Summa" hint={`Kassada: ${money(avail)}`}>
        <MoneyInput name="amount" defaultValue={avail > 0 ? avail : undefined} required />
      </Field>
      <Field label="Izoh">
        <input name="note" className="field" maxLength={200} placeholder="Masalan: kunlik topshirish" />
      </Field>
    </ActionForm>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-semibold text-fg-muted">{label}</div>
      <div className={cn('mt-1 text-lg font-extrabold tnum', tone === 'warn' && 'text-warn')}>{value}</div>
    </div>
  );
}
