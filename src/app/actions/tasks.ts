'use server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks, staffReports, graduates, students } from '@/db/schema';
import { assertBranch } from '@/lib/branch';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { addDays, today } from '@/lib/dates';

export async function saveTask(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('tasks');
    const assigneeId = int(fd, 'assigneeId') ?? u.id;
    if (u.role !== 'rahbar' && u.role !== 'admin' && assigneeId !== u.id) throw new Error('Boshqalarga vazifani rahbar yoki administrator beradi.');
    const v = {
      title: req(fd, 'title', 'Vazifa'),
      description: str(fd, 'description'),
      assigneeId,
      dueDate: str(fd, 'dueDate'),
      priority: (str(fd, 'priority') || 'orta') as 'past' | 'orta' | 'yuqori',
    };
    if (id) {
      const [t] = await db.select({ creatorId: tasks.creatorId }).from(tasks).where(eq(tasks.id, id));
      if (!t) throw new Error('Vazifa topilmadi.');
      if (u.role !== 'rahbar' && t.creatorId !== u.id) throw new Error('Vazifani faqat uni bergan odam tahrirlaydi.');
      await db.update(tasks).set(v).where(eq(tasks.id, id));
    }
    else await db.insert(tasks).values({ ...v, creatorId: u.id });
    return { message: id ? 'Vazifa yangilandi' : 'Vazifa berildi' };
  });
}

export async function setTaskStatus(id: number, status: 'yangi' | 'jarayonda' | 'bajarildi') {
  return run(async () => {
    const u = await assertSection('tasks');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!t) throw new Error('Vazifa topilmadi.');
    if (u.role !== 'rahbar' && t.assigneeId !== u.id && t.creatorId !== u.id) throw new Error("Bu vazifa sizniki emas.");
    await db.update(tasks).set({ status, doneAt: status === 'bajarildi' ? new Date() : null }).where(eq(tasks.id, id));
    return { message: status === 'bajarildi' ? 'Bajarildi' : 'Holat yangilandi' };
  });
}

export async function deleteTask(id: number) {
  return run(async () => {
    const u = await assertSection('tasks');
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!t) throw new Error('Vazifa topilmadi.');
    if (u.role !== 'rahbar' && t.creatorId !== u.id) throw new Error("Vazifani bergan odam o'chiradi.");
    await db.delete(tasks).where(eq(tasks.id, id));
    return { message: "Vazifa o'chirildi" };
  });
}

export async function submitReport(fd: FormData) {
  return run(async () => {
    const u = await assertSection('reports');
    const date = str(fd, 'date') || today();
    // Hisobotni faqat bugun yoki kecha uchun yozish mumkin (nazorat ballarini soxtalashtirib bo'lmasin)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today() || date < addDays(today(), -1)) throw new Error('Hisobotni faqat bugun yoki kecha uchun yozish mumkin.');
    await db.insert(staffReports).values({
      userId: u.id,
      date,
      kind: str(fd, 'kind') || 'kunlik',
      done: req(fd, 'done', 'Bugun nima qilindi'),
      problems: str(fd, 'problems'),
      plan: str(fd, 'plan'),
    });
    return { message: 'Hisobot yuborildi' };
  });
}

export async function saveGraduate(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('graduates');
    await assertBranch('student', studentId);
    const [st] = await db.select({ status: students.status, name: students.fullName }).from(students).where(eq(students.id, studentId));
    if (!st || st.status !== 'bitirgan') throw new Error("Bu o'quvchi bitiruvchi emas.");
    const v = {
      workplace: str(fd, 'workplace'),
      position: str(fd, 'position'),
      monthlyIncome: int(fd, 'monthlyIncome'),
      freelance: bool(fd, 'freelance'),
      studyingAt: str(fd, 'studyingAt'),
      lastContactAt: str(fd, 'lastContactAt') || today(),
      referrals: int(fd, 'referrals') ?? 0,
      inTelegramGroup: bool(fd, 'inTelegramGroup'),
      note: str(fd, 'note'),
      updatedAt: new Date(),
    };
    if (v.monthlyIncome !== null && (v.monthlyIncome < 0 || v.monthlyIncome > 1_000_000_000)) throw new Error("Daromad noto'g'ri.");
    await db.insert(graduates).values({ studentId, ...v }).onConflictDoUpdate({ target: graduates.studentId, set: v });
    void u;
    return { message: "Bitiruvchi ma'lumotlari saqlandi" };
  });
}
