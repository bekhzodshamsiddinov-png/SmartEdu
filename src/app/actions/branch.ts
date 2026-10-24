'use server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { branches } from '@/db/schema';
import { assertSection, getCurrentUser } from '@/lib/auth';
import { run, req, str } from '@/lib/action';
import { BRANCH_COOKIE } from '@/lib/branch';

export async function setBranch(id: number | null) {
  const u = await getCurrentUser();
  if (!u || u.branchId) return;
  const store = await cookies();
  if (id) store.set(BRANCH_COOKIE, String(id), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  else store.delete(BRANCH_COOKIE);
  revalidatePath('/', 'layout');
}

export async function saveBranch(id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('settings');
    const v = { name: req(fd, 'name', 'Filial nomi'), address: str(fd, 'address'), phone: str(fd, 'phone') };
    if (id) await db.update(branches).set(v).where(eq(branches.id, id));
    else await db.insert(branches).values(v);
    return { message: id ? 'Filial yangilandi' : "Filial qo'shildi" };
  });
}

export async function toggleBranch(id: number) {
  return run(async () => {
    await assertSection('settings');
    const [b] = await db.select().from(branches).where(eq(branches.id, id));
    if (!b) throw new Error('Filial topilmadi.');
    const list = await db.select().from(branches);
    if (b.active && list.filter((x) => x.active).length <= 1) throw new Error("Kamida bitta faol filial bo'lishi kerak.");
    await db.update(branches).set({ active: !b.active }).where(eq(branches.id, id));
    return { message: b.active ? 'Filial yopildi' : 'Filial qayta ochildi' };
  });
}
