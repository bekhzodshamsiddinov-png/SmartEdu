'use client';
import { useState } from 'react';
import { ExternalLink, Globe, Medal, Trash2 } from 'lucide-react';
import { Badge, Field, cn } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { addResult, deleteResult, toggleResultPublic } from '@/app/actions/results';
import { RESULT_LEVELS, RESULT_META, RESULT_PLACES, RESULT_TYPES } from '@/lib/constants';
import { money } from '@/lib/format';
import { fmtDate, today } from '@/lib/dates';

export type ResultRow = { id: number; type: string; title: string; amount: number | null; date: string; note: string | null; place: string | null; level: string | null; link: string | null; isPublic: boolean };

export const placeLabel = (k: string | null) => RESULT_PLACES.find((p) => p.k === k)?.l ?? null;
export const levelLabel = (k: string | null) => RESULT_LEVELS.find((p) => p.k === k)?.l ?? null;

/** Yutuq qo'shish formasi: turi tanlanganda kerakli maydonlar (o'rin, daromad) ochiladi */
export function ResultForm({ studentId, onDone }: { studentId: number; onDone?: () => void }) {
  const [type, setType] = useState(RESULT_TYPES[0]);
  const meta = RESULT_META[type] ?? {};
  return (
    <ActionForm action={addResult.bind(null, studentId)} onDone={onDone} onCancel={onDone} submitLabel="Yutuqni saqlash">
      <Field label="Turi">
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="field" required>
          {RESULT_TYPES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field label="Yutuq">
        <input
          name="title"
          className="field"
          maxLength={160}
          required
          placeholder={
            type === 'Play Market ilova' ? "Ilova nomi: masalan, «Namangan taksi»" : type === 'YouTube daromad' ? 'Kanal nomi va nima uchun' : type === 'Loyiha sotdi' ? 'Qanday loyiha, kimga' : "Masalan: Viloyat IT olimpiadasi"
          }
        />
      </Field>
      {meta.place && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="O'rni">
            <select name="place" className="field" defaultValue="">
              <option value="">—</option>
              {RESULT_PLACES.map((p) => (
                <option key={p.k} value={p.k}>
                  {p.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Darajasi">
            <select name="level" className="field" defaultValue="">
              <option value="">—</option>
              {RESULT_LEVELS.map((p) => (
                <option key={p.k} value={p.k}>
                  {p.l}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sana">
          <input type="date" name="date" defaultValue={today()} max={today()} className="field" />
        </Field>
        {meta.money ? (
          <Field label={type === 'Ishga kirdi' ? 'Oylik maoshi' : type === 'Grant' ? 'Grant summasi' : 'Daromad'}>
            <MoneyInput name="amount" />
          </Field>
        ) : (
          <div />
        )}
      </div>
      <Field label="Isbot havolasi" hint="Play Market, YouTube, sertifikat yoki yangilik sahifasi (ixtiyoriy)">
        <input name="link" type="url" inputMode="url" className="field" placeholder="https://" maxLength={400} />
      </Field>
      <Field label="Izoh">
        <input name="note" className="field" maxLength={400} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="isPublic" className="mt-0.5 h-4 w-4 accent-[#0E7C6B]" />
        <span>
          <b>Saytdagi «Yutuqlarimiz» sahifasida ko&apos;rsatish</b>
          <span className="block text-xs text-fg-muted">Faqat o&apos;quvchi va ota-onasi rozi bo&apos;lsa. Saytda ism va familiyaning bosh harfi chiqadi.</span>
        </span>
      </label>
    </ActionForm>
  );
}

export function ResultList({ rows, canEdit, empty }: { rows: ResultRow[]; canEdit: boolean; empty?: string }) {
  if (!rows.length) return <p className="px-4 py-4 text-sm text-fg-muted">{empty ?? "Musobaqa, Play Market'dagi ilova, sotilgan loyiha, YouTube daromadi, ishga kirish — hammasini shu yerga yozing."}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3 px-4 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white" style={{ background: RESULT_META[r.type]?.color ?? '#8C9A97' }}>
            <Medal className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold">{r.title}</span>
              {placeLabel(r.place) && <Badge tone={r.place === '1' ? 'good' : 'brand'}>{placeLabel(r.place)}</Badge>}
              {r.isPublic && (
                <span title="Saytda ko'rsatiladi" className="text-good">
                  <Globe className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">
              {r.type}
              {levelLabel(r.level) ? `, ${levelLabel(r.level)}` : ''}, {fmtDate(r.date)}
              {r.amount ? `, ${money(r.amount)}` : ''}
              {r.note ? `. ${r.note}` : ''}
            </div>
            {r.link && (
              <a href={r.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                <ExternalLink className="h-3 w-3" /> Isbot
              </a>
            )}
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-start gap-1">
              <ActionButton size="icon" variant="ghost" action={() => toggleResultPublic(r.id)} title={r.isPublic ? 'Saytdan olish' : 'Saytda ko\'rsatish'}>
                <Globe className={cn('h-4 w-4', r.isPublic ? 'text-good' : 'text-fg-faint')} />
              </ActionButton>
              <ActionButton size="icon" variant="ghost" action={() => deleteResult(r.id)} confirm="Yutuq o'chirilsinmi?" title="O'chirish">
                <Trash2 className="h-4 w-4" />
              </ActionButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
