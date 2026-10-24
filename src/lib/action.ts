export type ActionResult = { ok: true; message?: string; id?: number } | { ok: false; error: string };

export async function run(fn: () => Promise<void | { message?: string; id?: number }>): Promise<ActionResult> {
  try {
    const r = await fn();
    return { ok: true, ...(r || {}) };
  } catch (e: unknown) {
    const err = e as { message?: string; digest?: string };
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    console.error(e);
    const msg = err?.message || 'Kutilmagan xato yuz berdi.';
    if (/duplicate key|unique/i.test(msg)) return { ok: false, error: 'Bunday yozuv allaqachon mavjud.' };
    return { ok: false, error: msg.length > 200 ? 'Saqlashda xato yuz berdi.' : msg };
  }
}

export function str(fd: FormData, k: string) {
  const v = fd.get(k);
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
}

export function req(fd: FormData, k: string, label: string) {
  const v = str(fd, k);
  if (!v) throw new Error(`"${label}" maydonini to'ldiring.`);
  return v;
}

export function int(fd: FormData, k: string) {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/[\s ,]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function bool(fd: FormData, k: string) {
  const v = fd.get(k);
  return v === 'on' || v === 'true' || v === '1';
}
