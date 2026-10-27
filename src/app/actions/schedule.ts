'use server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, req, int } from '@/lib/action';
import { resolveBranch, lockedBranch } from '@/lib/branch';

function managers(role: string) {
  if (role !== 'rahbar' && role !== 'admin') throw new Error('Xonalarni rahbar yoki administrator boshqaradi.');
}

export async function saveRoom(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('schedule');
    managers(u.role);
    const locked = await lockedBranch();
    if (id && locked) {
      const [r] = await db.select({ b: rooms.branchId }).from(rooms).where(eq(rooms.id, id));
      if (!r) throw new Error('Xona topilmadi.');
      if (r.b && r.b !== locked) throw new Error('Bu xona boshqa filialga tegishli.');
    }
    const capacity = int(fd, 'capacity') ?? 12;
    if (capacity < 1 || capacity > 500) throw new Error("Sig'imni to'g'ri kiriting.");
    const v = { name: req(fd, 'name', 'Xona nomi').slice(0, 40), capacity, branchId: await resolveBranch(int(fd, 'branchId')) };
    if (id) await db.update(rooms).set(v).where(eq(rooms.id, id));
    else await db.insert(rooms).values(v);
    return { message: id ? 'Xona yangilandi' : "Xona qo'shildi" };
  });
}

export async function toggleRoom(id: number) {
  return run(async () => {
    const u = await assertSection('schedule');
    managers(u.role);
    const [r] = await db.select().from(rooms).where(eq(rooms.id, id));
    if (!r) throw new Error('Xona topilmadi.');
    const locked = await lockedBranch();
    if (locked && r.branchId && r.branchId !== locked) throw new Error('Bu xona boshqa filialga tegishli.');
    await db.update(rooms).set({ active: !r.active }).where(eq(rooms.id, id));
    return { message: r.active ? "Xona o'chirildi" : 'Xona yoqildi' };
  });
}
