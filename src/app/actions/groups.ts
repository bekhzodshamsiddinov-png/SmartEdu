'use server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { groups, courses, enrollments, students } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { DAY_CODES } from '@/lib/dates';
import { assertBranch, resolveBranch } from '@/lib/branch';

function onlyManagers(role: string) {
  if (!['rahbar', 'admin'].includes(role)) throw new Error("Guruhlarni rahbar yoki administrator boshqaradi.");
}

function daysFrom(fd: FormData) {
  const d = fd.getAll('days').map(String).filter((x) => DAY_CODES.includes(x));
  if (!d.length) throw new Error('Dars kunlarini tanlang.');
  return DAY_CODES.filter((x) => d.includes(x)).join(',');
}

export async function saveGroup(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    const courseId = int(fd, 'courseId');
    if (!courseId) throw new Error("Yo'nalishni tanlang.");
    const v = {
      name: req(fd, 'name', 'Guruh nomi'),
      courseId,
      teacherId: int(fd, 'teacherId'),
      supportId: int(fd, 'supportId'),
      days: daysFrom(fd),
      startTime: req(fd, 'startTime', 'Boshlanish vaqti'),
      endTime: req(fd, 'endTime', 'Tugash vaqti'),
      room: str(fd, 'room'),
      capacity: int(fd, 'capacity') ?? 14,
      startDate: str(fd, 'startDate'),
      branchId: fd.has('branchId') || !id ? await resolveBranch(int(fd, 'branchId')) : undefined,
    };
    if (id) await db.update(groups).set(v).where(eq(groups.id, id));
    else await db.insert(groups).values(v);
    return { message: id ? 'Guruh yangilandi' : 'Guruh ochildi' };
  });
}

export async function closeGroup(id: number) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    await db.update(groups).set({ active: false }).where(eq(groups.id, id));
    return { message: 'Guruh yopildi' };
  });
}

export async function reopenGroup(id: number) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    await db.update(groups).set({ active: true }).where(eq(groups.id, id));
    return { message: 'Guruh qayta ochildi' };
  });
}

export async function saveCourse(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    if (u.role !== 'rahbar') throw new Error("Yo'nalish va narxlarni rahbar belgilaydi.");
    const v = {
      name: req(fd, 'name', "Yo'nalish nomi"),
      monthlyPrice: int(fd, 'monthlyPrice') ?? 0,
      durationMonths: int(fd, 'durationMonths') ?? 3,
      color: str(fd, 'color') || '#008A70',
      description: str(fd, 'description'),
      active: id ? bool(fd, 'active') : true,
    };
    if (id) await db.update(courses).set(v).where(eq(courses.id, id));
    else await db.insert(courses).values(v);
    return { message: id ? "Yo'nalish yangilandi" : "Yo'nalish qo'shildi" };
  });
}

export async function moveStudent(enrollmentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    const groupId = int(fd, 'groupId');
    if (!groupId) throw new Error('Yangi guruhni tanlang.');
    await assertBranch('enrollment', enrollmentId);
    await assertBranch('group', groupId);
    const [e] = await db.select().from(enrollments).where(and(eq(enrollments.id, enrollmentId), isNull(enrollments.endDate)));
    if (!e) throw new Error('Yozuv topilmadi.');
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    await db.update(enrollments).set({ active: false, endDate: d }).where(eq(enrollments.id, enrollmentId));
    await db.insert(enrollments).values({ studentId: e.studentId, groupId, monthlyFee: e.monthlyFee, startDate: d });
    const [g] = await db.select({ b: groups.branchId }).from(groups).where(eq(groups.id, groupId));
    if (g?.b) await db.update(students).set({ branchId: g.b }).where(eq(students.id, e.studentId));
    return { message: "Boshqa guruhga o'tkazildi" };
  });
}
