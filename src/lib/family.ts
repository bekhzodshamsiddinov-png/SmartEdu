import 'server-only';
import { cache } from 'react';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { authSecret } from './session';

/**
 * Ota-ona mobil ilovasi sessiyasi. Cookie'da faqat o'quvchi id si va ota-ona havolasi xeshining
 * bir qismi saqlanadi (imzolangan). Havola yangilansa yoki bekor qilinsa — ilova ham darhol uziladi.
 */
export const FAMILY_COOKIE = (process.env.NODE_ENV === 'production' ? '__Host-' : '') + 'smartedu_family';
const MAX_AGE = 60 * 60 * 24 * 180;
const MAX_KIDS = 6;
const secret = () => new TextEncoder().encode(authSecret() + ':family');

export type Kid = { s: number; h: string };
export type Child = { id: number; name: string; status: string; cabinetHash: string };

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

async function readKids(): Promise<Kid[]> {
  const t = (await cookies()).get(FAMILY_COOKIE)?.value;
  if (!t) return [];
  try {
    const { payload } = await jwtVerify(t, secret(), { algorithms: ['HS256'] });
    const k = payload.k;
    if (!Array.isArray(k)) return [];
    return k
      .filter((x): x is Kid => !!x && typeof x === 'object' && Number.isInteger((x as Kid).s) && typeof (x as Kid).h === 'string')
      .slice(0, MAX_KIDS);
  } catch {
    return [];
  }
}

export async function writeKids(kids: Kid[]) {
  const jar = await cookies();
  if (!kids.length) {
    jar.set(FAMILY_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return;
  }
  const token = await new SignJWT({ k: kids.slice(0, MAX_KIDS) }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  jar.set(FAMILY_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE });
}

/** Ilovaga ulangan va havolasi hali amal qilayotgan farzandlar */
export const getChildren = cache(async (): Promise<Child[]> => {
  const kids = await readKids();
  if (!kids.length) return [];
  const rows = await db.execute<{ id: number; name: string; status: string; h: string | null }>(sql`
    select id, full_name name, status::text, cabinet_hash h from students where id in (${sql.join(kids.map((k) => sql`${k.s}`), sql`, `)})`);
  return kids
    .map((k) => rows.find((r) => r.id === k.s && r.h && r.h.slice(0, 24) === k.h))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ id: r.id, name: r.name, status: r.status, cabinetHash: r.h! }));
});

export async function addChild(studentId: number, cabinetHash: string) {
  const kids = (await readKids()).filter((k) => k.s !== studentId);
  await writeKids([{ s: studentId, h: cabinetHash.slice(0, 24) }, ...kids]);
}

export async function removeChild(studentId: number) {
  await writeKids((await readKids()).filter((k) => k.s !== studentId));
}

/** Tanlangan farzand (ilovada almashtiriladi) */
export const SELECTED_COOKIE = 'smartedu_kid';
export async function currentChild(): Promise<Child | null> {
  const kids = await getChildren();
  if (!kids.length) return null;
  const sel = Number((await cookies()).get(SELECTED_COOKIE)?.value);
  return kids.find((k) => k.id === sel) ?? kids[0];
}
