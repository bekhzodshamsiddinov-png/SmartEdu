'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, settings, courses } from '@/db/schema';
import { SignJWT, jwtVerify } from 'jose';
import { SESSION_COOKIE, authSecret, sessionCookieOptions, signSession } from '@/lib/session';
import { hashBackup, legacyBackupHash, tryOpenSecret, verifyTotp } from '@/lib/totp';
import { normalizePhone } from '@/lib/format';
import { today } from '@/lib/dates';
import { notifyTelegram } from '@/lib/payments';
import { LOCK_MESSAGE, audit, auditExternal, clearHits, clientIp, guardLogin, hashPassword, isTrustedDevice, rememberDevice, overLimit, passwordProblem, safeEqual, verifyPassword } from '@/lib/security';

export type AuthState = { error?: string; step?: 'code' } | undefined;

const PENDING_COOKIE = (process.env.NODE_ENV === 'production' ? '__Host-' : '') + 'smartedu_2fa';
const pendingKey = () => new TextEncoder().encode(authSecret() + ':2fa-pending');

/** Yangi joydan kirilsa rahbarga xabar (oxirgi 60 kunda bu IP dan kirilmagan bo'lsa) */
async function newDeviceAlert(u: { id: number; fullName: string; role: string }, ip: string) {
  const [seen] = await db.execute<{ c: number }>(sql`
    select count(*)::int c from audit_log where actor_type = 'xodim' and actor_id = ${u.id} and action = 'Tizimga kirdi' and ip = ${ip}
      and created_at > now() - interval '60 days'`);
  if (!seen.c) {
    const [any] = await db.execute<{ c: number }>(sql`select count(*)::int c from audit_log where actor_id = ${u.id} and action = 'Tizimga kirdi'`);
    if (any.c) await notifyTelegram(`🔐 SmartEdu: ${u.fullName} (${u.role}) yangi joydan tizimga kirdi.\nIP: ${ip}\nAgar bu siz bo'lmasangiz — parolni darhol almashtiring.`);
  }
}

async function finishLogin(u: { id: number; fullName: string; role: string; sessionVersion: number; phone: string }, ip: string, via: string) {
  await rememberDevice('staff', u.phone);
  await newDeviceAlert(u, ip);
  await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Tizimga kirdi', detail: via || null, ip });
  const token = await signSession({ uid: u.id, role: u.role, v: u.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(u.role === 'admin' ? '/ish-stoli' : '/');
}

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (!phone || !password) return { error: 'Telefon raqam va parolni kiriting.' };
  if (password.length > 128) return { error: "Telefon raqam yoki parol noto'g'ri." };
  const ip = await clientIp();
  const g = await guardLogin('staff', phone, ip, await isTrustedDevice('staff', phone));
  if (g.alert) {
    // Raqamga hujum boshlanganini rahbarga bir marta bildiramiz (spam bo'lmaydi)
    await audit({ actorType: 'tizim', action: 'Kirish bloklandi', detail: `Parol terib topishga urinish: +${phone}`, ip });
    await notifyTelegram(`🚨 SmartEdu: +${phone} raqamiga parolni terib topishga urinish (15 daqiqada 10 marta). Kirish vaqtincha bloklandi.\nIP: ${ip}`);
  }
  if (g.blocked) return { error: LOCK_MESSAGE };
  const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!(await verifyPassword(password, u?.passwordHash)) || !u) {
    await auditExternal('Xato parol', `Xodim kirishi: +${phone}`);
    return { error: "Telefon raqam yoki parol noto'g'ri." };
  }
  if (!u.active) return { error: "Hisobingiz o'chirilgan. Rahbarga murojaat qiling." };
  await g.success();
  if (u.totpEnabled) {
    // Parol to'g'ri — endi telefondagi kod so'raladi (5 daqiqa ichida)
    const t = await new SignJWT({ uid: u.id, v: u.sessionVersion }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(pendingKey());
    (await cookies()).set(PENDING_COOKIE, t, { ...sessionCookieOptions, maxAge: 300 });
    return { step: 'code' };
  }
  await finishLogin(u, ip, '');
  return undefined;
}

/** 2-bosqich: Authenticator ilovasidagi 6 xonali kod yoki zaxira kod */
export async function verifyLoginCode(_: AuthState, fd: FormData): Promise<AuthState> {
  const store = await cookies();
  let uid = 0;
  let v = -1;
  try {
    const { payload } = await jwtVerify(store.get(PENDING_COOKIE)?.value ?? '', pendingKey(), { algorithms: ['HS256'] });
    uid = Number(payload.uid);
    v = Number(payload.v);
  } catch {
    return { error: 'Vaqt tugadi. Telefon raqam va parolni qayta kiriting.' };
  }
  const ip = await clientIp();
  if (await overLimit('2fa', `u:${uid}`, 5, 15)) return { step: 'code', error: LOCK_MESSAGE };
  const [u] = await db.select().from(users).where(eq(users.id, uid));
  if (!u || !u.active || u.sessionVersion !== v || !u.totpEnabled || !u.totpSecret) return { error: 'Qaytadan kiring.' };
  const code = String(fd.get('code') || '').trim().slice(0, 12);
  let via = '';
  /** Xato koddan keyin: 5-xatoda rahbarga xabar va jarayon bekor qilinadi (parol qayta so'raladi) */
  const failed = async (msg: string) => {
    const [r] = await db.execute<{ c: number }>(sql`select count(*)::int c from auth_attempts where scope = '2fa' and key = ${`u:${uid}`} and created_at > now() - interval '15 minutes'`);
    if ((r?.c ?? 0) >= 5) {
      store.set(PENDING_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
      await notifyTelegram(`🚨 SmartEdu: ${u.fullName} hisobiga to'g'ri parol bilan kirib, 2FA kodini topishga urinishmoqda (5 marta xato).\nIP: ${ip}\nParolni darhol almashtiring!`);
      return { error: "Juda ko'p xato kod. Xavfsizlik uchun qaytadan kiring." };
    }
    return { step: 'code' as const, error: msg };
  };
  const plain = tryOpenSecret(u.totpSecret);
  const step = plain ? verifyTotp(plain, code, u.totpLastStep) : null;
  if (step !== null) {
    // Atomar: shu kod parallel ikkinchi marta ishlatilmasin
    const ok = await db.execute<{ id: number }>(sql`update users set totp_last_step = ${step} where id = ${u.id} and totp_last_step < ${step} returning id`);
    if (!ok.length) return failed("Kod noto'g'ri yoki eskirgan.");
    via = 'Ikki bosqichli';
  } else {
    const list: string[] = JSON.parse(u.totpBackup || '[]');
    const h = [hashBackup(code), legacyBackupHash(code)].find((x) => list.includes(x)) ?? '';
    if (!/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(code) || !h) {
      await audit({ actorType: 'tizim', action: 'Xato 2FA kodi', detail: u.fullName, ip });
      return failed("Kod noto'g'ri. Telefoningizdagi ilovadan yangi kodni kiriting.");
    }
    const rest = list.filter((x) => x !== h);
    const ok = await db.execute<{ id: number }>(sql`update users set totp_backup = ${JSON.stringify(rest)} where id = ${u.id} and totp_backup = ${u.totpBackup} returning id`);
    if (!ok.length) return { step: 'code', error: 'Qayta urinib ko\'ring.' };
    via = `Zaxira kod bilan (${rest.length} ta qoldi)`;
    await notifyTelegram(`⚠️ SmartEdu: ${u.fullName} zaxira kod bilan kirdi. ${rest.length} ta kod qoldi.`);
  }
  store.set(PENDING_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  await clearHits('2fa', `u:${uid}`);
  await finishLogin(u, ip, via);
  return undefined;
}

export async function logout() {
  (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  redirect('/login');
}

async function usersCount() {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  return r?.c ?? 0;
}

export async function setup(_: AuthState, fd: FormData): Promise<AuthState> {
  if ((await usersCount()) > 0) return { error: 'Tizim allaqachon sozlangan. Kirish sahifasidan foydalaning.' };
  const ip = await clientIp();
  if (await overLimit('setup', ip, 5, 60)) return { error: LOCK_MESSAGE };
  const code = process.env.SETUP_CODE;
  if (!code && process.env.NODE_ENV === 'production') return { error: 'Sozlash kodi serverda o\'rnatilmagan.' };
  if (code && !safeEqual(String(fd.get('code') || '').trim(), code)) {
    return { error: "Sozlash kodi noto'g'ri." };
  }
  const fullName = String(fd.get('fullName') || '').trim();
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  const centerName = String(fd.get('centerName') || '').trim() || 'United IT Clubs';
  if (fullName.length < 3) return { error: "Ism-familiyani to'liq kiriting." };
  if (phone.length < 9) return { error: "Telefon raqamni to'g'ri kiriting." };
  const pwErr = passwordProblem(password, phone);
  if (pwErr) return { error: pwErr };
  const hash = await hashPassword(password);
  // Ikki kishi bir vaqtda sozlasa ham faqat bittasi rahbar bo'ladi
  const u = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7311001)`);
    const [c] = await tx.select({ c: sql<number>`count(*)::int` }).from(users);
    if (c.c > 0) return null;
    const [row] = await tx
      .insert(users)
      .values({ fullName, phone, passwordHash: hash, role: 'rahbar', position: 'Asoschi, rahbar', hiredAt: today() })
      .returning();
    return row;
  });
  if (!u) return { error: 'Tizim allaqachon sozlangan. Kirish sahifasidan foydalaning.' };
  await db.insert(settings).values({ id: 1, centerName }).onConflictDoNothing();
  const existing = await db.select({ id: courses.id }).from(courses).limit(1);
  if (!existing.length) {
    await db.insert(courses).values([
      { name: 'Kompyuter savodxonligi', monthlyPrice: 300000, durationMonths: 3, color: '#3D6FD1' },
      { name: "Sun'iy intellekt (AI)", monthlyPrice: 450000, durationMonths: 3, color: '#008A70' },
      { name: 'YouTube blogging', monthlyPrice: 400000, durationMonths: 2, color: '#C2862A' },
      { name: 'Fullstack AI dasturlash', monthlyPrice: 700000, durationMonths: 6, color: '#7A5BC7' },
    ]);
  }
  await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Tizim sozlandi', ip });
  await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Tizimga kirdi', detail: 'Birinchi sozlash', ip });
  const token = await signSession({ uid: u.id, role: u.role, v: u.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect('/');
}
