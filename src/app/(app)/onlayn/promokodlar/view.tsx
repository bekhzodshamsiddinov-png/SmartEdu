'use client';
import { useState } from 'react';
import { Plus, TicketPercent, Pencil, Power } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionButton, ActionForm } from '@/components/action-form';
import { OnlineTabsClient } from '@/components/online/tabs-client';
import { savePromo, togglePromo } from '@/app/actions/online';
import { money } from '@/lib/format';
import { fmtShort, today } from '@/lib/dates';

type P = { id: number; code: string; percent: number | null; amount: number | null; course_id: number | null; course: string | null; max_uses: number | null; used: number; valid_until: string | null; active: boolean; revenue: number };

export function PromoView({ rows, courses, canEdit }: { rows: P[]; courses: { id: number; title: string }[]; canEdit: boolean }) {
  const [edit, setEdit] = useState<P | 'new' | null>(null);
  const t = today();
  return (
    <>
      <PageHeader
        title="Promokodlar"
        sub="Chegirma kodlari: blogerlar, aksiyalar va bitiruvchilar uchun"
        actions={
          canEdit && (
            <Button onClick={() => setEdit('new')}>
              <Plus className="h-4 w-4" /> Promokod
            </Button>
          )
        }
      />
      <OnlineTabsClient active="/onlayn/promokodlar" />
      <Card>
        {rows.length === 0 ? (
          <Empty icon={<TicketPercent className="h-5 w-5" />} title="Promokod yo'q" text="Masalan, AI20 kodi bilan 20% chegirma bering va qaysi kanal ko'proq sotganini kuzating." action={canEdit ? <Button onClick={() => setEdit('new')}>Promokod yaratish</Button> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className="th">Kod</th>
                  <th className="th">Chegirma</th>
                  <th className="th">Kurs</th>
                  <th className="th text-right">Ishlatildi</th>
                  <th className="th text-right">Tushum</th>
                  <th className="th">Holat</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => {
                  const expired = p.valid_until && p.valid_until < t;
                  const full = p.max_uses !== null && p.used >= p.max_uses;
                  const live = p.active && !expired && !full;
                  return (
                    <tr key={p.id} className={cn(!live && 'opacity-60')}>
                      <td className="td">
                        <span className="rounded-md bg-ink px-2 py-1 font-mono text-[13px] font-bold tracking-wider text-white">{p.code}</span>
                      </td>
                      <td className="td font-bold tnum">{p.percent ? `${p.percent}%` : money(p.amount ?? 0)}</td>
                      <td className="td text-[13px]">{p.course ?? 'Barcha kurslar'}</td>
                      <td className="td text-right tnum">
                        {p.used}
                        {p.max_uses !== null && <span className="text-fg-muted"> / {p.max_uses}</span>}
                      </td>
                      <td className="td text-right font-semibold tnum">{money(p.revenue)}</td>
                      <td className="td">
                        {live ? <Badge tone="good">Faol</Badge> : <Badge tone="neutral">{!p.active ? "O'chirilgan" : expired ? 'Muddati tugagan' : 'Limit tugagan'}</Badge>}
                        {p.valid_until && live && <div className="mt-0.5 text-xs text-fg-muted">{fmtShort(p.valid_until)} gacha</div>}
                      </td>
                      <td className="td whitespace-nowrap text-right">
                        {canEdit && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => setEdit(p)} aria-label="Tahrirlash">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <ActionButton variant="ghost" size="icon" action={() => togglePromo(p.id)} title={p.active ? "O'chirish" : 'Yoqish'}>
                              <Power className="h-4 w-4" />
                            </ActionButton>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Yangi promokod' : 'Promokodni tahrirlash'} size="sm">
        {edit && <PromoForm p={edit === 'new' ? null : edit} courses={courses} onDone={() => setEdit(null)} />}
      </Modal>
    </>
  );
}

function PromoForm({ p, courses, onDone }: { p: P | null; courses: { id: number; title: string }[]; onDone: () => void }) {
  const [type, setType] = useState(p?.amount ? 'amount' : 'percent');
  return (
    <ActionForm action={savePromo.bind(null, p?.id ?? null)} onDone={onDone} onCancel={onDone}>
      <Field label="Kod" hint="Lotin harflari va raqamlar, masalan AI20">
        <input name="code" defaultValue={p?.code} className="field font-mono uppercase tracking-wider" required />
      </Field>
      <Field label="Chegirma turi">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['percent', 'Foiz (%)'],
            ['amount', "Summa (so'm)"],
          ].map(([k, l]) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-field border border-line-strong text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong">{l}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label={type === 'percent' ? 'Foiz' : 'Summa'}>
        <input name="value" type="number" min={1} defaultValue={p ? (p.percent ?? p.amount ?? '') : ''} className="field" required />
      </Field>
      <Field label="Qaysi kurs uchun">
        <select name="courseId" defaultValue={p?.course_id ?? ''} className="field">
          <option value="">Barcha kurslar</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Necha marta">
          <input name="maxUses" type="number" min={1} defaultValue={p?.max_uses ?? ''} className="field" placeholder="Cheksiz" />
        </Field>
        <Field label="Amal qiladi">
          <input name="validUntil" type="date" defaultValue={p?.valid_until ?? ''} className="field" />
        </Field>
      </div>
    </ActionForm>
  );
}
