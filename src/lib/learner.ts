import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '@/db';
import { learners } from '@/db/schema';
import { authSecret } from './session';

export const LEARNER_COOKIE = 'smartedu_learner';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return new TextEncoder().encode(authSecret() + ':learner');
}

export async function signLearner(lid: number, v: number) {
  return new SignJWT({ lid, v }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
}

export async function setLearnerCookie(lid: number, v: number) {
  (await cookies()).set(LEARNER_COOKIE, await signLearner(lid, v), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export type Learner = { id: number; fullName: string; phone: string };

export const getLearner = cache(async (): Promise<Learner | null> => {
  const token = (await cookies()).get(LEARNER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const lid = Number(payload.lid);
    if (!lid) return null;
    const [l] = await db
      .select({ id: learners.id, fullName: learners.fullName, phone: learners.phone, v: learners.sessionVersion, hasPw: learners.passwordHash })
      .from(learners)
      .where(eq(learners.id, lid));
    // Parol almashtirilsa yoki "hamma qurilmalardan chiqish" bosilsa eski sessiyalar bekor bo'ladi
    if (!l || !l.hasPw || l.v !== (typeof payload.v === 'number' ? payload.v : 0)) return null;
    return { id: l.id, fullName: l.fullName, phone: l.phone };
  } catch {
    return null;
  }
});

export async function requireLearner(next: string) {
  const l = await getLearner();
  if (!l) redirect(`/akademiya/kirish?next=${encodeURIComponent(next)}`);
  return l;
}
