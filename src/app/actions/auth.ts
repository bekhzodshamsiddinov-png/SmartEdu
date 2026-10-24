'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, settings, courses } from '@/db/schema';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';
import { normalizePhone } from '@/lib/format';
import { today } from '@/lib/dates';
import { notifyTelegram } from '@/lib/payments';
import { LOCK_MESSAGE, audit, clientIp, guardLogin, hashPassword, overLimit, passwordProblem, safeEqual, verifyPassword } from '@/lib/security';

export type AuthState = { error?: string } | undefined;

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (!phone || !password) return { error: 'Telefon raqam va parolni kiriting.' };
  if (password.length > 128) return { error: "Telefon raqam yoki parol noto'g'ri." };
  const ip = await clientIp();
  const g = await guardLogin('staff', phone, ip);
  if (g.alert) {
    // Raqamga hujum boshlanganini rahbarga bir marta bildiramiz (spam bo'lmaydi)
    await audit({ actorType: 'tizim', action: 'Kirish bloklandi', detail: `Parol terib topishga urinish: +${phone}`, ip });
    await notifyTelegram(`🚨 SmartEdu: +${phone} raqamiga parolni terib topishga urinish (15 daqiqada 10 marta). Kirish vaqtincha bloklandi.\nIP: ${ip}`);
  }
  if (g.blocked) return { error: LOCK_MESSAGE };
  const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!(await verifyPassword(password, u?.passwordHash)) || !u) {
    await audit({ actorType: 'tizim', action: 'Xato parol', detail: `Xodim kirishi: +${phone}`, ip });
    return { error: "Telefon raqam yoki parol noto'g'ri." };
  }
  if (!u.active) return { error: "Hisobingiz o'chirilgan. Rahbarga murojaat qiling." };
  await g.success();
  await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Tizimga kirdi', ip });
  const token = await signSession({ uid: u.id, role: u.role, v: u.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(u.role === 'admin' ? '/ish-stoli' : '/');
}

export async function logout() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/' });
  redirect('/login');
}

export async function usersCount() {
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
  const token = await signSession({ uid: u.id, role: u.role, v: u.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect('/');
}
