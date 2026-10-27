import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { authSecret } from './session';

/**
 * Ikki bosqichli kirish: RFC 6238 TOTP (Google Authenticator, Microsoft Authenticator va boshqalar bilan ishlaydi).
 * Sir bazada AES-256-GCM bilan shifrlangan — baza o'g'irlansa ham kodlarni yasab bo'lmaydi.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 30;

function b32encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32decode(s: string) {
  const clean = s.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newSecret() {
  return b32encode(randomBytes(20));
}

function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / PERIOD);
}

/** To'g'ri bo'lsa ishlatilgan qadam raqamini qaytaradi (±30 soniya farqga ruxsat), aks holda null */
export function verifyTotp(secret: string, code: string, lastStep: number, now = Date.now()) {
  const c = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const s0 = currentStep(now);
  for (const st of [s0, s0 - 1, s0 + 1]) {
    // Bir marta ishlatilgan kodni qayta ishlatib bo'lmaydi
    if (st <= lastStep) continue;
    const a = Buffer.from(codeAt(secret, st));
    if (timingSafeEqual(a, Buffer.from(c))) return st;
  }
  return null;
}

/** Test va QR uchun: hozirgi kod */
export function totpNow(secret: string) {
  return codeAt(secret, currentStep());
}

export function otpauthUrl(secret: string, account: string, issuer = 'SmartEdu') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${PERIOD}`;
}

/** Shifrlash kaliti: alohida TOTP_ENC_KEY bo'lsa o'sha, bo'lmasa AUTH_SECRET'dan olinadi */
function key() {
  return createHash('sha256').update((process.env.TOTP_ENC_KEY || authSecret()) + ':totp-encryption').digest();
}

/** Ochib bo'lmasa (kalit almashgan) null — shunda zaxira kod bilan kirish mumkin bo'ladi */
export function tryOpenSecret(sealed: string) {
  try {
    return openSecret(sealed);
  } catch {
    return null;
  }
}

export function sealSecret(secret: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function openSecret(sealed: string) {
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1') throw new Error('totp secret format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

/** Telefon yo'qolsa ishlatiladigan bir martalik zaxira kodlar: XXXX-XXXX */
export function newBackupCodes(n = 8) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => {
    const r = randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += A[r[i] % A.length];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

/** Zaxira kod xeshi: serverdagi maxfiy kalit bilan HMAC — baza o'g'irlansa ham kodlarni terib topib bo'lmaydi */
export function hashBackup(code: string) {
  const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return 'h1:' + createHmac('sha256', createHash('sha256').update(authSecret() + ':backup-pepper').digest()).update(norm).digest('hex');
}

/** Eski (kalitsiz) formatdagi xesh — oldin yaratilgan kodlar ishlashda davom etishi uchun */
export function legacyBackupHash(code: string) {
  return createHash('sha256').update('smartedu-backup:' + code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}
