'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, settings, courses } from '@/db/schema';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';
import { normalizePhone } from '@/lib/format';
import { today } from '@/lib/dates';

export type AuthState = { error?: string } | undefined;

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (!phone || !password) return { error: 'Telefon raqam va parolni kiriting.' };
  const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return { error: "Telefon raqam yoki parol noto'g'ri." };
  if (!u.active) return { error: "Hisobingiz o'chirilgan. Rahbarga murojaat qiling." };
  const token = await signSession({ uid: u.id, role: u.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(u.role === 'admin' ? '/ish-stoli' : '/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function usersCount() {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  return r?.c ?? 0;
}

export async function setup(_: AuthState, fd: FormData): Promise<AuthState> {
  if ((await usersCount()) > 0) return { error: 'Tizim allaqachon sozlangan. Kirish sahifasidan foydalaning.' };
  const code = process.env.SETUP_CODE;
  if (code && String(fd.get('code') || '').trim() !== code) return { error: "Sozlash kodi noto'g'ri." };
  const fullName = String(fd.get('fullName') || '').trim();
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  const centerName = String(fd.get('centerName') || '').trim() || 'United IT Clubs';
  if (fullName.length < 3) return { error: "Ism-familiyani to'liq kiriting." };
  if (phone.length < 9) return { error: "Telefon raqamni to'g'ri kiriting." };
  if (password.length < 6) return { error: "Parol kamida 6 belgidan iborat bo'lsin." };
  const hash = await bcrypt.hash(password, 10);
  const [u] = await db
    .insert(users)
    .values({ fullName, phone, passwordHash: hash, role: 'rahbar', position: 'Asoschi, rahbar', hiredAt: today() })
    .returning();
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
  const token = await signSession({ uid: u.id, role: u.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect('/');
}
