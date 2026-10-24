'use server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, settings, type Role } from '@/db/schema';
import { assertSection, getCurrentUser } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';

export async function saveStaff(id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('staff');
    const role = req(fd, 'role', 'Lavozim') as Role;
    if (!(role in ROLE_LABELS)) throw new Error("Lavozim noto'g'ri.");
    const v = {
      fullName: req(fd, 'fullName', 'Ism-familiya'),
      phone: normalizePhone(req(fd, 'phone', 'Telefon')),
      role,
      position: str(fd, 'position'),
      baseSalary: int(fd, 'baseSalary') ?? 0,
      bonusRule: str(fd, 'bonusRule'),
      hiredAt: str(fd, 'hiredAt'),
      branchId: role === 'rahbar' ? null : int(fd, 'branchId'),
    };
    const pw = str(fd, 'password');
    if (id) {
      await db
        .update(users)
        .set({ ...v, ...(pw ? { passwordHash: await bcrypt.hash(pw, 10) } : {}) })
        .where(eq(users.id, id));
      return { message: "Xodim ma'lumotlari yangilandi" };
    }
    if (!pw || pw.length < 6) throw new Error("Parol kamida 6 belgidan iborat bo'lsin.");
    await db.insert(users).values({ ...v, passwordHash: await bcrypt.hash(pw, 10) });
    return { message: "Xodim qo'shildi" };
  });
}

export async function toggleStaff(id: number) {
  return run(async () => {
    const me = await assertSection('staff');
    if (me.id === id) throw new Error("O'zingizni o'chira olmaysiz.");
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) throw new Error('Xodim topilmadi.');
    await db.update(users).set({ active: !u.active }).where(eq(users.id, id));
    return { message: u.active ? 'Xodim faolsizlantirildi' : 'Xodim qayta faollashtirildi' };
  });
}

export async function changeMyPassword(fd: FormData) {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new Error('Tizimga qayta kiring.');
    const [u] = await db.select().from(users).where(eq(users.id, me.id));
    if (!(await bcrypt.compare(req(fd, 'current', 'Joriy parol'), u.passwordHash))) throw new Error("Joriy parol noto'g'ri.");
    const next = req(fd, 'next', 'Yangi parol');
    if (next.length < 6) throw new Error("Yangi parol kamida 6 belgi bo'lsin.");
    await db.update(users).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(users.id, me.id));
    return { message: "Parol o'zgartirildi" };
  });
}

export async function saveSettings(fd: FormData) {
  return run(async () => {
    await assertSection('settings');
    const v = {
      centerName: req(fd, 'centerName', 'Markaz nomi'),
      phone: str(fd, 'phone'),
      address: str(fd, 'address'),
      paymentDueDay: Math.min(28, Math.max(1, int(fd, 'paymentDueDay') ?? 5)),
      salaryDay: Math.min(28, Math.max(1, int(fd, 'salaryDay') ?? 10)),
      reservePercent: Math.min(50, Math.max(0, int(fd, 'reservePercent') ?? 10)),
      updatedAt: new Date(),
    };
    await db.insert(settings).values({ id: 1, ...v }).onConflictDoUpdate({ target: settings.id, set: v });
    return { message: 'Sozlamalar saqlandi' };
  });
}
