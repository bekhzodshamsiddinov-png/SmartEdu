import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { branches, users } from '@/db/schema';
import { getCurrentUser } from './auth';

export const BRANCH_COOKIE = 'smartedu_branch';

export const allBranches = cache(async () => db.select().from(branches).orderBy(asc(branches.id)));

/** Joriy filial: xodim o'z filialiga bog'langan bo'lsa shu, aks holda tanlangan (yoki hammasi = null) */
export const getBranchScope = cache(async (): Promise<{ id: number | null; locked: boolean; name: string | null }> => {
  const u = await getCurrentUser();
  const list = await allBranches();
  if (u?.branchId) return { id: u.branchId, locked: true, name: list.find((b) => b.id === u.branchId)?.name ?? null };
  const raw = Number((await cookies()).get(BRANCH_COOKIE)?.value);
  const b = list.find((x) => x.id === raw && x.active);
  return { id: b?.id ?? null, locked: false, name: b?.name ?? null };
});

/** SQL: "and <ustun> = filial" yoki bo'sh */
export function andBranch(col: SQL | string, id: number | null): SQL {
  if (!id) return sql``;
  return typeof col === 'string' ? sql`and ${sql.raw(col)} = ${id}` : sql`and ${col} = ${id}`;
}

/** Yangi yozuv uchun filial: tanlangan, aks holda birinchi faol filial */
export async function branchForNew(): Promise<number | null> {
  const s = await getBranchScope();
  if (s.id) return s.id;
  const list = await allBranches();
  return list.find((b) => b.active)?.id ?? null;
}

/* ---------- Filial bo'yicha ruxsat tekshiruvi (server action'lar uchun) ---------- */

/** Xodim bitta filialga bog'langan bo'lsa, shu filial id'si; aks holda null (cheklov yo'q) */
export async function lockedBranch(): Promise<number | null> {
  const u = await getCurrentUser();
  return u && u.role !== 'rahbar' && u.branchId ? u.branchId : null;
}

type Kind = 'student' | 'group' | 'lead' | 'transaction' | 'attendance' | 'enrollment';

const LOOKUP: Record<Kind, (id: number) => SQL> = {
  student: (id) => sql`select branch_id b from students where id = ${id}`,
  group: (id) => sql`select branch_id b from groups where id = ${id}`,
  lead: (id) => sql`select branch_id b from leads where id = ${id}`,
  transaction: (id) => sql`select branch_id b from transactions where id = ${id}`,
  attendance: (id) => sql`select g.branch_id b from attendance a join groups g on g.id = a.group_id where a.id = ${id}`,
  enrollment: (id) => sql`select s.branch_id b from enrollments e join students s on s.id = e.student_id where e.id = ${id}`,
};

/** Filialga bog'langan xodim boshqa filial yozuviga tegolmasin */
export async function assertBranch(kind: Kind, id: number | null | undefined) {
  const locked = await lockedBranch();
  if (!locked || !id) return;
  const rows = await db.execute<{ b: number | null }>(LOOKUP[kind](id));
  if (!rows.length) throw new Error('Yozuv topilmadi.');
  if (rows[0].b !== null && rows[0].b !== locked) throw new Error("Bu yozuv boshqa filialga tegishli.");
}

/** Yangi yozuv uchun filial: bog'langan xodimda doim o'z filiali, aks holda formadagi yoki tanlangan */
export async function resolveBranch(formValue: number | null): Promise<number | null> {
  const locked = await lockedBranch();
  if (locked) return locked;
  return formValue ?? (await branchForNew());
}

/**
 * Tayinlanayotgan xodim haqiqiy, faol, kerakli rolda va shu filialda (yoki filialsiz) ekanini tekshiradi.
 */
export async function assertStaffFor(userId: number | null, roles: string[], branchId: number | null | undefined) {
  if (!userId) return;
  const [u] = await db.select({ role: users.role, active: users.active, b: users.branchId }).from(users).where(eq(users.id, userId));
  if (!u || !u.active || !roles.includes(u.role)) throw new Error("Tanlangan xodim bu vazifaga mos emas.");
  if (branchId && u.b && u.b !== branchId) throw new Error('Tanlangan xodim boshqa filialda ishlaydi.');
}
