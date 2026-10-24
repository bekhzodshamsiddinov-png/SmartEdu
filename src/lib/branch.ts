import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { asc, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { branches } from '@/db/schema';
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
