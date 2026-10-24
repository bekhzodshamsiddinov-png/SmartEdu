import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type Role } from '@/db/schema';
import { SESSION_COOKIE, verifySession } from './session';
import { can, type Section } from './roles';

export type CurrentUser = { id: number; fullName: string; role: Role; phone: string; position: string | null; branchId: number | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const [u] = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, phone: users.phone, position: users.position, active: users.active, branchId: users.branchId })
    .from(users)
    .where(eq(users.id, s.uid))
    .limit(1);
  if (!u || !u.active) return null;
  return { id: u.id, fullName: u.fullName, role: u.role, phone: u.phone, position: u.position, branchId: u.role === 'rahbar' ? null : u.branchId };
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

/** Sahifa uchun: ruxsat bo'lmasa bosh sahifaga qaytaradi */
export async function requireSection(section: Section) {
  const u = await requireUser();
  if (!can(u.role, section)) redirect('/?ruxsat=yoq');
  return u;
}

/** Server action uchun: ruxsat bo'lmasa xato tashlaydi */
export async function assertSection(section: Section) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Tizimga qayta kiring.');
  if (!can(u.role, section)) throw new Error("Bu amal uchun ruxsatingiz yo'q.");
  return u;
}
