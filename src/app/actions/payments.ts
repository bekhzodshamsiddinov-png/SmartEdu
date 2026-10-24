'use server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments, enrollments, notes } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, int } from '@/lib/action';
import { today } from '@/lib/dates';
import { assertBranch } from '@/lib/branch';
import { students } from '@/db/schema';
import { and } from 'drizzle-orm';
import { audit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';
import { money } from '@/lib/format';

const MAX_AMOUNT = 100_000_000;
const isDate = (d: string | null) => !d || (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)));

export async function addPayment(fd: FormData) {
  return run(async () => {
    const u = await assertSection('payments');
    const studentId = int(fd, 'studentId');
    if (!studentId) throw new Error("O'quvchini tanlang.");
    await assertBranch('student', studentId);
    const [st] = await db.select({ b: students.branchId }).from(students).where(eq(students.id, studentId));
    const amount = int(fd, 'amount');
    if (!amount || amount <= 0) throw new Error("To'lov summasini kiriting.");
    if (amount > MAX_AMOUNT) throw new Error("Summa juda katta — raqamni tekshiring.");
    const paidAt = str(fd, 'paidAt') || today();
    if (!isDate(paidAt) || paidAt > today()) throw new Error("To'lov sanasi noto'g'ri (kelajakdagi sana bo'lmaydi).");
    let enrollmentId = int(fd, 'enrollmentId');
    if (enrollmentId) {
      // Boshqa o'quvchining guruhiga to'lov yozib bo'lmaydi
      const [own] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.id, enrollmentId), eq(enrollments.studentId, studentId)));
      if (!own) throw new Error("Guruh noto'g'ri tanlangan.");
    }
    if (!enrollmentId) {
      const [e] = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.studentId, studentId)).orderBy(desc(enrollments.active), desc(enrollments.id)).limit(1);
      enrollmentId = e?.id ?? null;
    }
    const method = (str(fd, 'method') || 'naqd') as 'naqd' | 'click' | 'payme' | 'karta' | 'bank';
    await db.insert(payments).values({
      studentId,
      enrollmentId,
      amount,
      method,
      forMonth: str(fd, 'forMonth'),
      paidAt,
      note: str(fd, 'note'),
      receivedById: u.id,
      branchId: st?.b ?? null,
    });
    const [sn] = await db.select({ n: students.fullName }).from(students).where(eq(students.id, studentId));
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "To'lov qabul qilindi", detail: `${sn?.n}: ${money(amount)} (${method}, ${paidAt})` });
    return { message: "To'lov qabul qilindi" };
  });
}

export async function deletePayment(id: number) {
  return run(async () => {
    const u = await assertSection('payments');
    if (u.role !== 'rahbar') throw new Error("To'lovni faqat rahbar bekor qila oladi.");
    const [p] = await db
      .select({ amount: payments.amount, paidAt: payments.paidAt, method: payments.method, name: students.fullName })
      .from(payments)
      .leftJoin(students, eq(students.id, payments.studentId))
      .where(eq(payments.id, id));
    if (!p) throw new Error("To'lov topilmadi.");
    await db.delete(payments).where(eq(payments.id, id));
    const d = `${p.name}: ${money(p.amount)} (${p.method}, ${p.paidAt})`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "To'lov o'chirildi", detail: d });
    await notifyTelegram(`🗑 SmartEdu: to'lov o'chirildi\n${d}\nKim: ${u.fullName}`);
    return { message: "To'lov bekor qilindi" };
  });
}

export async function logReminder(studentId: number) {
  return run(async () => {
    const u = await assertSection('payments');
    await assertBranch('student', studentId);
    await db.insert(notes).values({ entityType: 'student', entityId: studentId, kind: 'qongiroq', text: "To'lov bo'yicha eslatma berildi", authorId: u.id });
    return { message: 'Eslatma qayd etildi' };
  });
}
