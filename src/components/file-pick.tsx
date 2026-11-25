'use client';
import { useRef, useState } from 'react';
import { FileText, ImageIcon, Paperclip, X } from 'lucide-react';

export const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
const MAX = 3 * 1024 * 1024;

/** Telefon rasmlari katta (5–10 MB) bo'ladi: 1800 px gacha kichraytirib JPEG qilamiz — sertifikat o'qiladi, hajm 300–600 KB */
export async function shrink(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 900_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d');
    if (!ctx) return f;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return f;
  }
}

/** Fayllarni tayyorlaydi: rasmlar siqiladi, 3 MB dan kattasi rad etiladi */
export async function prepareFiles(list: FileList | File[], limit = 6): Promise<{ files: File[]; error: string | null }> {
  const all = [...list].slice(0, limit);
  const files: File[] = [];
  for (const f of all) {
    const s = await shrink(f);
    if (s.size > MAX) return { files: [], error: `«${f.name}» 3 MB dan katta. PDF ni siqib yoki rasm qilib yuklang.` };
    files.push(s);
  }
  return { files, error: [...list].length > limit ? `Ko'pi bilan ${limit} ta fayl.` : null };
}

/** Forma ichidagi fayl tanlash: tanlangan fayllar ro'yxati, siqish, "files" nomi bilan formaga qo'shiladi */
export function FilePick({ name = 'files', label = 'Sertifikat yoki loyiha rasmi' }: { name?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function sync(next: File[]) {
    setFiles(next);
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (ref.current) ref.current.files = dt.files;
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input
        ref={ref}
        type="file"
        name={name}
        multiple
        accept={ACCEPT}
        className="sr-only"
        id={`fp-${name}`}
        onChange={async (e) => {
          const picked = e.target.files ? [...e.target.files] : [];
          setBusy(true);
          const r = await prepareFiles([...files, ...picked]);
          setBusy(false);
          setError(r.error);
          sync(r.error && !r.files.length ? files : r.files);
        }}
      />
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-field border border-line bg-canvas px-3 py-2 text-sm">
              {f.type === 'application/pdf' ? <FileText className="h-4 w-4 shrink-0 text-bad" /> : <ImageIcon className="h-4 w-4 shrink-0 text-brand" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-fg-muted tnum">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button type="button" onClick={() => sync(files.filter((_, j) => j !== i))} className="text-fg-faint hover:text-bad" aria-label={`${f.name} ni olib tashlash`}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        htmlFor={`fp-${name}`}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-field border border-dashed border-line-strong px-3 py-3 text-sm font-semibold text-fg-muted hover:bg-canvas hover:text-fg"
      >
        <Paperclip className="h-4 w-4" /> {busy ? 'Tayyorlanmoqda...' : files.length ? "Yana fayl qo'shish" : 'Fayl tanlash (PDF yoki rasm, 3 MB gacha)'}
      </label>
      {error && <p className="mt-1.5 text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}
