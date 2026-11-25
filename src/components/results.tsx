'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ExternalLink, FileText, Globe, Link2, Medal, Paperclip, Trash2, X } from 'lucide-react';
import { Badge, Field, cn } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { addResult, addResultFiles, deleteResult, deleteResultFile, setResultLink, toggleResultPublic } from '@/app/actions/results';
import { Modal } from '@/components/modal';
import { useToast } from '@/components/toast';
import { ACCEPT, FilePick, prepareFiles } from '@/components/file-pick';
import { RESULT_LEVELS, RESULT_META, RESULT_PLACES, RESULT_TYPES } from '@/lib/constants';
import { money } from '@/lib/format';
import { fmtDate, today } from '@/lib/dates';

export type ResultFile = { id: number; name: string; mime: string; size: number };
export type ResultRow = { id: number; type: string; title: string; amount: number | null; date: string; note: string | null; place: string | null; level: string | null; link: string | null; isPublic: boolean; files?: ResultFile[] };

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
      <Field label="Loyiha yoki isbot havolasi" hint="Sayt, GitHub, Play Market, YouTube, Telegram bot yoki yangilik sahifasi (ixtiyoriy)">
        <input name="link" type="url" inputMode="url" className="field" placeholder="https://" maxLength={400} />
      </Field>
      <FilePick label="Sertifikat, diplom yoki loyiha rasmi (ixtiyoriy)" />
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

export function ResultList({ rows, canEdit, canAttach = canEdit, empty }: { rows: ResultRow[]; canEdit: boolean; canAttach?: boolean; empty?: string }) {
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
            <ResultExtras r={r} canEdit={canEdit} canAttach={canAttach} />
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

const isImg = (m: string) => m.startsWith('image/');
export const fileUrl = (id: number, dl = false) => `/api/yutuq-fayl/${id}${dl ? '?yukla=1' : ''}`;

/** Yutuq ostidagi havola va fayllar (sertifikat, loyiha rasmlari) + qo'shish tugmalari */
export function ResultExtras({ r, canEdit, canAttach }: { r: ResultRow; canEdit: boolean; canAttach: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const files = r.files ?? [];
  let host = '';
  try {
    host = r.link ? new URL(r.link).hostname.replace(/^www\./, '') : '';
  } catch {}

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const p = await prepareFiles(list, 6 - files.length);
    if (p.error && !p.files.length) return toast(p.error, 'err');
    const fd = new FormData();
    p.files.forEach((f) => fd.append('files', f));
    start(async () => {
      const res = await addResultFiles(r.id, fd);
      if (res.ok) {
        toast(res.message ?? 'Yuklandi');
        router.refresh();
      } else toast(res.error, 'err');
    });
    if (input.current) input.current.value = '';
  }

  return (
    <>
      {(r.link || files.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {r.link && (
            <a href={r.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-semibold text-brand hover:border-brand">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{host || 'Havola'}</span>
            </a>
          )}
          {files.map((f) => (
            <span key={f.id} className="group relative inline-flex items-center">
              <a
                href={fileUrl(f.id)}
                target="_blank"
                rel="noopener"
                title={f.name}
                className={cn('inline-flex items-center gap-1.5 overflow-hidden rounded-xl border border-line bg-white text-xs font-semibold hover:border-brand', isImg(f.mime) ? 'h-14 w-14 justify-center' : 'h-8 max-w-[200px] px-3')}
              >
                {isImg(f.mime) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(f.id)} alt={f.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 shrink-0 text-bad" /> <span className="truncate">{f.name}</span>
                  </>
                )}
              </a>
              <a href={fileUrl(f.id, true)} className="ml-0.5 grid h-6 w-6 place-items-center rounded-full text-fg-faint hover:text-brand" title="Yuklab olish" aria-label={`${f.name} ni yuklab olish`}>
                <Download className="h-3.5 w-3.5" />
              </a>
              {canEdit && (
                <ActionButton size="icon" variant="ghost" action={() => deleteResultFile(f.id)} confirm="Fayl o'chirilsinmi?" title="Faylni o'chirish" className="!h-6 !w-6">
                  <X className="h-3.5 w-3.5" />
                </ActionButton>
              )}
            </span>
          ))}
        </div>
      )}
      {canAttach && (
        <div className="mt-1.5 flex flex-wrap gap-3">
          {files.length < 6 && (
            <>
              <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Sertifikat yuklash" />
              <button type="button" onClick={() => input.current?.click()} disabled={pending} className="inline-flex items-center gap-1 text-xs font-bold text-fg-muted hover:text-brand disabled:opacity-50">
                <Paperclip className="h-3.5 w-3.5" /> {pending ? 'Yuklanmoqda...' : 'Sertifikat / rasm'}
              </button>
            </>
          )}
          <button type="button" onClick={() => setLinkOpen(true)} className="inline-flex items-center gap-1 text-xs font-bold text-fg-muted hover:text-brand">
            <Link2 className="h-3.5 w-3.5" /> {r.link ? 'Havolani o\'zgartirish' : 'Loyiha havolasi'}
          </button>
        </div>
      )}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Loyiha havolasi" size="sm">
        {linkOpen && (
          <ActionForm action={setResultLink.bind(null, r.id)} onDone={() => setLinkOpen(false)} onCancel={() => setLinkOpen(false)}>
            <Field label="Havola" hint="Sayt, GitHub, Play Market, YouTube yoki Telegram bot. Bo'sh qoldirilsa havola o'chadi.">
              <input name="link" type="url" inputMode="url" defaultValue={r.link ?? ''} className="field" placeholder="https://" maxLength={400} autoFocus />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
