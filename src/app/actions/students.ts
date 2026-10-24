'use server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { students, enrollments, groups, courses, notes, grades, results, graduates, leads } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { today } from '@/lib/dates';

async function feeFor(groupId: number) {
  const [g] = await db
    .select({ price: courses.monthlyPrice })
    .from(groups)
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .where(eq(groups.id, groupId));
  return g?.price ?? 0;
}

export async function createStudent(fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("O'quvchini administrator qo'shadi.");
    const p = str(fd, 'phone');
    const pp = str(fd, 'parentPhone');
    const joinedAt = str(fd, 'joinedAt') || today();
    const [s] = await db
      .insert(students)
      .values({
        fullName: req(fd, 'fullName', 'Ism-familiya'),
        phone: p ? normalizePhone(p) : null,
        parentName: str(fd, 'parentName'),
        parentPhone: pp ? normalizePhone(pp) : null,
        birthYear: int(fd, 'birthYear'),
        school: str(fd, 'school'),
        address: str(fd, 'address'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
        joinedAt,
        leadId: int(fd, 'leadId'),
      })
      .returning({ id: students.id });
    const groupId = int(fd, 'groupId');
    if (groupId) {
      const fee = int(fd, 'monthlyFee') ?? (await feeFor(groupId));
      await db.insert(enrollments).values({ studentId: s.id, groupId, monthlyFee: fee, startDate: str(fd, 'startDate') || joinedAt });
    }
    const leadId = int(fd, 'leadId');
    if (leadId) await db.update(leads).set({ studentId: s.id, stage: 'tolov_qildi', maxStage: 4, updatedAt: new Date() }).where(eq(leads.id, leadId));
    return { id: s.id, message: "O'quvchi qo'shildi" };
  });
}

export async function updateStudent(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support' || u.role === 'bugalter') throw new Error("Ma'lumotni administrator o'zgartiradi.");
    const p = str(fd, 'phone');
    const pp = str(fd, 'parentPhone');
    await db
      .update(students)
      .set({
        fullName: req(fd, 'fullName', 'Ism-familiya'),
        phone: p ? normalizePhone(p) : null,
        parentName: str(fd, 'parentName'),
        parentPhone: pp ? normalizePhone(pp) : null,
        birthYear: int(fd, 'birthYear'),
        school: str(fd, 'school'),
        address: str(fd, 'address'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
        joinedAt: str(fd, 'joinedAt') || undefined,
      })
      .where(eq(students.id, id));
    return { message: "Ma'lumotlar yangilandi" };
  });
}

/** Holatni o'zgartirish: ketdi / bitirdi / muzlatildi / qayta faollashtirildi */
export async function changeStatus(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'bugalter') throw new Error("Holatni administrator o'zgartiradi.");
    const status = req(fd, 'status', 'Holat') as 'faol' | 'xavf' | 'muzlatilgan' | 'ketgan' | 'bitirgan';
    const date = str(fd, 'date') || today();
    if (status === 'ketgan') {
      const reason = req(fd, 'leftReason', 'Ketish sababi');
      await db
        .update(students)
        .set({ status, leftAt: date, leftReason: reason, returnAttempt: str(fd, 'returnAttempt'), returnResult: str(fd, 'returnResult') })
        .where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      if (str(fd, 'returnAttempt'))
        await db.insert(notes).values({ entityType: 'student', entityId: id, kind: 'qongiroq', text: `Qaytarish urinishi: ${str(fd, 'returnAttempt')}. Natija: ${str(fd, 'returnResult') || '—'}`, authorId: u.id });
      return { message: "O'quvchi ketgan deb belgilandi" };
    }
    if (status === 'bitirgan') {
      await db.update(students).set({ status, graduatedAt: date }).where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      await db.insert(graduates).values({ studentId: id, lastContactAt: date }).onConflictDoNothing();
      return { message: "Bitiruvchilar ro'yxatiga qo'shildi" };
    }
    if (status === 'muzlatilgan') {
      await db.update(students).set({ status }).where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      return { message: "O'qish vaqtincha to'xtatildi" };
    }
    await db.update(students).set({ status, leftAt: null, leftReason: null }).where(eq(students.id, id));
    const groupId = int(fd, 'groupId');
    if (groupId) {
      const fee = int(fd, 'monthlyFee') ?? (await feeFor(groupId));
      await db.insert(enrollments).values({ studentId: id, groupId, monthlyFee: fee, startDate: date });
    }
    return { message: status === 'xavf' ? 'Xavf ostida deb belgilandi' : "O'quvchi faol" };
  });
}

/** Return attempt result update for a student who left */
export async function updateReturn(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    const attempt = req(fd, 'returnAttempt', 'Nima qilindi');
    const result = req(fd, 'returnResult', 'Natija');
    await db.update(students).set({ returnAttempt: attempt, returnResult: result }).where(eq(students.id, id));
    await db.insert(notes).values({ entityType: 'student', entityId: id, kind: 'qongiroq', text: `Qaytarish urinishi: ${attempt}. Natija: ${result}`, authorId: u.id });
    return { message: 'Saqlandi' };
  });
}

export async function enroll(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Guruhga administrator qo'shadi.");
    const groupId = int(fd, 'groupId');
    if (!groupId) throw new Error('Guruhni tanlang.');
    const fee = int(fd, 'monthlyFee') ?? (await feeFor(groupId));
    await db.insert(enrollments).values({ studentId, groupId, monthlyFee: fee, startDate: str(fd, 'startDate') || today() });
    await db.update(students).set({ status: 'faol' }).where(and(eq(students.id, studentId), eq(students.status, 'muzlatilgan')));
    return { message: "Guruhga qo'shildi" };
  });
}

export async function endEnrollment(enrollmentId: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Ruxsat yo'q.");
    await db.update(enrollments).set({ active: false, endDate: today() }).where(eq(enrollments.id, enrollmentId));
    return { message: 'Guruhdan chiqarildi' };
  });
}

export async function updateFee(enrollmentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin'].includes(u.role)) throw new Error("Narxni rahbar yoki administrator o'zgartiradi.");
    const fee = int(fd, 'monthlyFee');
    if (fee === null || fee < 0) throw new Error("Oylik to'lovni kiriting.");
    await db.update(enrollments).set({ monthlyFee: fee }).where(eq(enrollments.id, enrollmentId));
    return { message: "Oylik to'lov yangilandi" };
  });
}

export async function addNote(entityType: 'student' | 'lead', entityId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection(entityType === 'lead' ? 'leads' : 'students');
    await db.insert(notes).values({ entityType, entityId, kind: str(fd, 'kind') || 'izoh', text: req(fd, 'text', 'Matn'), authorId: u.id });
    return { message: 'Yozib qo\'yildi' };
  });
}

export async function addGrade(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    const score = int(fd, 'score');
    if (score === null || score < 0 || score > 100) throw new Error("Baho 0 dan 100 gacha bo'lsin.");
    await db.insert(grades).values({ studentId, groupId: int(fd, 'groupId'), period: req(fd, 'period', 'Davr'), score, comment: str(fd, 'comment'), teacherId: u.id });
    return { message: 'Baho qo\'yildi' };
  });
}

export async function addResult(studentId: number, fd: FormData) {
  return run(async () => {
    await assertSection('students');
    await db.insert(results).values({
      studentId,
      type: req(fd, 'type', 'Turi'),
      title: req(fd, 'title', 'Natija'),
      amount: int(fd, 'amount'),
      date: str(fd, 'date') || today(),
      note: str(fd, 'note'),
    });
    return { message: 'Natija qo\'shildi' };
  });
}

export async function deleteStudent(id: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role !== 'rahbar') throw new Error("O'quvchini faqat rahbar o'chira oladi.");
    await db.delete(students).where(eq(students.id, id));
    return { message: "O'quvchi o'chirildi" };
  });
}
