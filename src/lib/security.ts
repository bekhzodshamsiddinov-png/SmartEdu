import 'server-only';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
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
  if (pw.length > 128) return 'Parol juda uzun.';
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

/**
 * Urinishni AVVAL yozib, keyin sanaymiz: bir vaqtda yuborilgan yuzlab so'rov ham
 * limitdan o'ta olmaydi (hisob-kitob atomar tartibda bo'ladi).
 * true — limit oshdi, amalni bajarmaslik kerak.
 */
export async function overLimit(scope: string, key: string, max: number, minutes: number) {
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

/**
 * Kirishni himoyalash (har urinish parol tekshirilishidan OLDIN hisobga olinadi):
 *  - bitta raqam + bitta IP: 5 urinish / 15 daqiqa (parol terib topish)
 *  - bitta IP: 30 urinish / 15 daqiqa (ko'p raqamni sinash)
 *  - bitta raqam, barcha IP lardan: 40 urinish / 15 daqiqa (taqsimlangan hujum)
 * Begona odam boshqa IP dan rahbarni "qulflab qo'ya" olmaydi — rahbarning o'z IP si alohida hisoblanadi.
 * Muvaffaqiyatli kirishda shu raqam+IP hisobi tozalanadi.
 */
export async function guardLogin(scope: string, phone: string, ip: string) {
  const pi = `pi:${phone}|${ip}`;
  const [a, b, c] = await Promise.all([overLimit(scope, pi, 5, 15), overLimit(scope, `ip:${ip}`, 30, 15), overLimit(scope, `p:${phone}`, 40, 15)]);
  const [cnt] = await db.execute<{ c: number }>(
    sql`select count(*)::int c from auth_attempts where scope = ${scope} and key = ${`p:${phone}`} and created_at > now() - interval '15 minutes'`,
  );
  return {
    blocked: a || b || c,
    /** Raqamga hujum boshlanganini bir marta bildirish uchun (10-urinishda) */
    alert: cnt?.c === 10,
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
