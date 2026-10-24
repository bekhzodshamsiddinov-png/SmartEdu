'use server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments, enrollments, notes } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, int } from '@/lib/action';
import { today } from '@/lib/dates';

export async function addPayment(fd: FormData) {
  return run(async () => {
    const u = await assertSection('payments');
    const studentId = int(fd, 'studentId');
    if (!studentId) throw new Error("O'quvchini tanlang.");
    const amount = int(fd, 'amount');
    if (!amount || amount <= 0) throw new Error("To'lov summasini kiriting.");
    let enrollmentId = int(fd, 'enrollmentId');
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
      paidAt: str(fd, 'paidAt') || today(),
      note: str(fd, 'note'),
      receivedById: u.id,
    });
    return { message: "To'lov qabul qilindi" };
  });
}

export async function deletePayment(id: number) {
  return run(async () => {
    const u = await assertSection('payments');
    if (u.role !== 'rahbar') throw new Error("To'lovni faqat rahbar bekor qila oladi.");
    await db.delete(payments).where(eq(payments.id, id));
    return { message: "To'lov bekor qilindi" };
  });
}

export async function logReminder(studentId: number) {
  return run(async () => {
    const u = await assertSection('payments');
    await db.insert(notes).values({ entityType: 'student', entityId: studentId, kind: 'qongiroq', text: "To'lov bo'yicha eslatma berildi", authorId: u.id });
    return { message: 'Eslatma qayd etildi' };
  });
}
