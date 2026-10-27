import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * O'quvchining davomat QR kodi (TOTP ga o'xshash):
 *  - ilovaga o'quvchiga xos maxfiy kalit beriladi (ota-ona havolasi bilan bog'liq — havola yangilansa kalit ham almashadi);
 *  - ilova har 30 soniyada yangi kod hosil qiladi (internet bo'lmasa ham ishlaydi);
 *  - skrinshot bir-ikki daqiqadan keyin yaroqsiz, kalitsiz kodni soxtalashtirib bo'lmaydi.
 */
export const QR_WINDOW = 30_000;
const master = () => createHmac('sha256', process.env.AUTH_SECRET ?? '').update('attendance-qr-v2').digest();

/** O'quvchi kaliti (base64url). cabinetHash — ota-ona havolasining xeshi */
export function studentQrKey(studentId: number, cabinetHash: string) {
  return createHmac('sha256', master()).update(`${studentId}.${cabinetHash}`).digest('base64url');
}

export function qrSignature(keyB64: string, studentId: number, win: number) {
  return createHmac('sha256', Buffer.from(keyB64, 'base64url')).update(`${studentId}.${win}`).digest('base64url').slice(0, 22);
}

/** Kodni tekshiradi: to'g'ri bo'lsa o'quvchi id sini qaytaradi */
export async function verifyQrToken(token: string, now = Date.now()): Promise<number | null> {
  if (!process.env.AUTH_SECRET) return null;
  const m = /^SE2\.(\d{1,9})\.(\d{1,12})\.([A-Za-z0-9_-]{22})$/.exec(token.trim());
  if (!m) return null;
  const sid = Number(m[1]);
  const win = Number(m[2]);
  const cur = Math.floor(now / QR_WINDOW);
  // Joriy va oldingi 2 oyna (≈ 1,5 daqiqa) — telefon soati biroz farq qilsa ham ishlaydi
  if (win > cur + 1 || win < cur - 2) return null;
  const [s] = await db.execute<{ h: string | null }>(sql`select cabinet_hash h from students where id = ${sid}`);
  if (!s?.h) return null;
  const a = Buffer.from(qrSignature(studentQrKey(sid, s.h), sid, win));
  const b = Buffer.from(m[3]);
  return a.length === b.length && timingSafeEqual(a, b) ? sid : null;
}
