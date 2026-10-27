import 'server-only';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { authSecret } from './session';
import { db } from '@/db';
import { auditLog } from '@/db/schema';

/** bcrypt ish narxi: 12 — bitta tekshiruv ~0.25 s, millionlab taxminni amalda imkonsiz qiladi */
const COST = 12;

/** Foydalanuvchi topilmaganda ham bir xil vaqt sarflash uchun (raqam mavjudligini vaqt bo'yicha bilib bo'lmasin) */
const DUMMY_HASH = '$2b$12$6Z53RY1YzOOx2i2W0e1whuLLtOCq6bnAmAGQ/KoQ1HEuABvQ3u8hm';

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(pw, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(pw, hash);
}

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'password', 'password1', 'qwerty123', 'qwertyui', '1q2w3e4r', 'abcd1234', 'parol123', 'admin123', 'smartedu',
  'iloveyou', 'uzbekistan', 'namangan', 'tashkent',
]);

/** Parol talabi: kamida 8 belgi, harf va raqam aralash, oddiy parollar taqiqlangan. Xato bo'lsa matn qaytaradi. */
export function passwordProblem(pw: string, phone?: string | null): string | null {
  if (pw.length < 8) return "Parol kamida 8 belgidan iborat bo'lsin.";
  if (Buffer.byteLength(pw, 'utf8') > 72) return "Parol juda uzun (ko'pi bilan 72 belgi).";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Parolda harf ham, raqam ham bo'lsin.";
  if (COMMON.has(pw.toLowerCase())) return 'Bu parol juda oddiy, boshqasini tanlang.';
  if (/^(.)\1+$/.test(pw)) return 'Bu parol juda oddiy, boshqasini tanlang.';
  const digits = phone?.replace(/\D/g, '');
  if (digits && digits.length >= 7 && pw.replace(/\D/g, '').includes(digits.slice(-7))) return "Parolda telefon raqamingizni ishlatmang.";
  return null;
}

/** Vercel bu sarlavhalarni o'zi qo'yadi (mijoz yuborgan qiymat ustidan yoziladi) */
export async function clientIp() {
  const h = await headers();
  const ip = h.get('x-vercel-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || '';
  return ip.trim().slice(0, 64) || 'unknown';
}

async function countHitsRaw(scope: string, key: string, minutes: number) {
  const [r] = await db.execute<{ c: number }>(
    sql`select count(*)::int c from auth_attempts where scope = ${scope} and key = ${key} and created_at > now() - make_interval(mins => ${minutes})`,
  );
  return r?.c ?? 0;
}

/**
 * Urinishni AVVAL yozib, keyin sanaymiz: bir vaqtda yuborilgan yuzlab so'rov ham
 * limitdan o'ta olmaydi (hisob-kitob atomar tartibda bo'ladi).
 * true — limit oshdi, amalni bajarmaslik kerak.
 */
export async function overLimit(scope: string, key: string, max: number, minutes: number) {
  // Allaqachon limitdan oshgan bo'lsa yozmaymiz — bloklangan so'rovlar jadvalni to'ldira olmaydi
  if ((await countHitsRaw(scope, key, minutes)) >= max + 1) return true;
  await db.execute(sql`insert into auth_attempts (scope, key) values (${scope}, ${key})`);
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from auth_attempts where created_at < now() - interval '2 days'`);
    await db.execute(sql`delete from audit_log where created_at < now() - interval '365 days'`);
  }
  const [r] = await db.execute<{ c: number }>(
    sql`select count(*)::int c from auth_attempts where scope = ${scope} and key = ${key} and created_at > now() - make_interval(mins => ${minutes})`,
  );
  return (r?.c ?? 0) > max;
}

export async function clearHits(scope: string, key: string) {
  await db.execute(sql`delete from auth_attempts where scope = ${scope} and key = ${key}`);
}

export const LOCK_MESSAGE = "Juda ko'p urinish bo'ldi. Xavfsizlik uchun 15 daqiqadan keyin qayta urinib ko'ring.";

async function countHits(scope: string, key: string, minutes: number) {
  const [r] = await db.execute<{ c: number }>(
    sql`select count(*)::int c from auth_attempts where scope = ${scope} and key = ${key} and created_at > now() - make_interval(mins => ${minutes})`,
  );
  return r?.c ?? 0;
}

/**
 * Kirishni himoyalash (har urinish parol tekshirilishidan OLDIN hisobga olinadi):
 *  - bitta raqam + bitta IP: 5 urinish / 15 daqiqa — qattiq blok (parol terib topish)
 *  - bitta IP: 60 urinish / 15 daqiqa — qattiq blok (ko'p raqamni sinash; markaz Wi-Fi'si uchun zaxira bor)
 *  - bitta raqam, barcha IP lardan: 40 urinish / 15 daqiqa — faqat NOTANISH qurilmalar uchun blok.
 *    Ilgari muvaffaqiyatli kirilgan ("ishonchli") qurilma bu blokka tushmaydi, shuning uchun
 *    hujumchi rahbarni o'z qurilmasidan qulflab qo'ya olmaydi.
 * Allaqachon bloklangan so'rov bazaga yozilmaydi (jadvalni to'ldirib bo'lmaydi).
 */
export async function guardLogin(scope: string, phone: string, ip: string, trusted: boolean) {
  const pi = `pi:${phone}|${ip}`;
  if ((await countHits(scope, pi, 15)) >= 5 || (await countHits(scope, `ip:${ip}`, 15)) >= 60) {
    return { blocked: true, alert: false, success: async () => {} };
  }
  await db.execute(sql`insert into auth_attempts (scope, key) values (${scope}, ${pi}), (${scope}, ${`ip:${ip}`}), (${scope}, ${`p:${phone}`})`);
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from auth_attempts where created_at < now() - interval '2 days'`);
    await db.execute(sql`delete from audit_log where created_at < now() - interval '365 days'`);
  }
  const [a, b, c] = await Promise.all([countHits(scope, pi, 15), countHits(scope, `ip:${ip}`, 15), countHits(scope, `p:${phone}`, 15)]);
  return {
    blocked: a > 5 || b > 60 || (!trusted && c > 40),
    /** Raqamga hujum boshlanganini bir marta bildirish uchun (10-urinishda) */
    alert: c === 10,
    success: async () => {
      await clearHits(scope, pi);
      await db.execute(sql`delete from auth_attempts where id = (select max(id) from auth_attempts where scope = ${scope} and key = ${`ip:${ip}`})`);
      await db.execute(sql`delete from auth_attempts where id = (select max(id) from auth_attempts where scope = ${scope} and key = ${`p:${phone}`})`);
    },
  };
}

/** Tashqi (autentifikatsiyasiz) hodisalarni yozish: bitta IP dan soatiga 30 tadan ko'p yozilmaydi — jurnalni to'ldirib bo'lmaydi */
export async function auditExternal(action: string, detail: string) {
  const ip = await clientIp().catch(() => 'unknown');
  if (await overLimit('audit-ext', ip, 30, 60)) return;
  await audit({ actorType: 'tizim', action, detail, ip });
}

export async function audit(e: { actorType: 'xodim' | 'oquvchi' | 'tizim'; actorId?: number | null; actorName?: string | null; action: string; detail?: string | null; ip?: string | null }) {
  try {
    await db.insert(auditLog).values({
      actorType: e.actorType,
      actorId: e.actorId ?? null,
      actorName: e.actorName?.slice(0, 120) ?? null,
      action: e.action.slice(0, 80),
      detail: e.detail?.slice(0, 500) ?? null,
      ip: e.ip ?? (await clientIp().catch(() => null)),
    });
  } catch (err) {
    console.error('audit', err);
  }
}

/** Taymingga chidamli satr solishtirish (uzunlik farqi ham sezilmaydi) */
export function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/* ---------- Ishonchli qurilma ---------- */

const deviceCookie = (scope: string) => (process.env.NODE_ENV === 'production' ? '__Host-' : '') + `smartedu_dev_${scope === 'staff' ? 's' : 'l'}`;
const deviceKey = () => new TextEncoder().encode(authSecret() + ':trusted-device');

/** Muvaffaqiyatli kirgan qurilmani 180 kunga eslab qoladi (faqat qulflash himoyasi uchun, sessiya emas) */
export async function rememberDevice(scope: string, phone: string) {
  const t = await new SignJWT({ s: scope, ph: phone }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('180d').sign(deviceKey());
  (await cookies()).set(deviceCookie(scope), t, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 180 * 86400 });
}

/** Shu qurilmadan avval shu raqam bilan muvaffaqiyatli kirilganmi */
export async function isTrustedDevice(scope: string, phone: string) {
  const t = (await cookies()).get(deviceCookie(scope))?.value;
  if (!t) return false;
  try {
    const { payload } = await jwtVerify(t, deviceKey(), { algorithms: ['HS256'] });
    return payload.s === scope && payload.ph === phone;
  } catch {
    return false;
  }
}
