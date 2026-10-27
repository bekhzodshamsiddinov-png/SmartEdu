'use server';
import { after } from 'next/server';
import { studentBalance } from '@/lib/finance';
import { onTimePaymentCoin } from '@/lib/coins';
import { enqueue, flushOutbox } from '@/lib/messaging';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { payments, enrollments, notes } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, int } from '@/lib/action';
import { today } from '@/lib/dates';
import { assertBranch } from '@/lib/branch';
import { students } from '@/db/schema';
import { and, isNull } from 'drizzle-orm';
import { cashboxForUser } from '@/lib/cashbox';
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
    if (!['naqd', 'click', 'payme', 'karta', 'bank'].includes(method)) throw new Error("To'lov usuli noto'g'ri.");
    // Pul qabul qilgan xodimning kassasiga (yoki asosiy kassaga) tushadi
    const box = await cashboxForUser(u.id);
    const [ins] = await db.insert(payments).values({
      studentId,
      enrollmentId,
      amount,
      method,
      forMonth: str(fd, 'forMonth'),
      paidAt,
      note: str(fd, 'note'),
      receivedById: u.id,
      branchId: st?.b ?? null,
      cashboxId: box.id,
    }).returning({ id: payments.id });
    const [sn] = await db.select({ n: students.fullName }).from(students).where(eq(students.id, studentId));
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "To'lov qabul qilindi", detail: `${sn?.n}: ${money(amount)} (${method}, ${paidAt})` });
    const bal = await studentBalance(studentId);
    await onTimePaymentCoin(studentId, paidAt, bal);
    await enqueue('tolov', studentId, { summa: money(amount), qoldiq: bal < 0 ? `qarz ${money(-bal)}` : money(bal) }, `pay:${ins.id}`);
    after(() => flushOutbox(10).catch(() => 0));
    return { id: ins.id, message: "To'lov qabul qilindi" };
  });
}

/** To'lovni bekor qilish: o'chirilmaydi, sababi bilan belgilanadi va hisobotlardan chiqadi */
export async function cancelPayment(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('payments');
    if (u.role !== 'rahbar') throw new Error("To'lovni faqat rahbar bekor qila oladi.");
    const reason = str(fd, 'reason');
    if (!reason || reason.length < 3) throw new Error('Bekor qilish sababini yozing.');
    const [p] = await db
      .select({ amount: payments.amount, paidAt: payments.paidAt, method: payments.method, name: students.fullName, cancelled: payments.cancelledAt })
      .from(payments)
      .leftJoin(students, eq(students.id, payments.studentId))
      .where(eq(payments.id, id));
    if (!p) throw new Error("To'lov topilmadi.");
    if (p.cancelled) throw new Error("To'lov allaqachon bekor qilingan.");
    const done = await db
      .update(payments)
      .set({ cancelledAt: new Date(), cancelledById: u.id, cancelReason: reason.slice(0, 200) })
      .where(and(eq(payments.id, id), isNull(payments.cancelledAt)))
      .returning({ id: payments.id });
    if (!done.length) throw new Error("To'lov allaqachon bekor qilingan.");
    const d = `${p.name}: ${money(p.amount)} (${p.method}, ${p.paidAt}). Sabab: ${reason}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "To'lov bekor qilindi", detail: d });
    await notifyTelegram(`🗑 SmartEdu: to'lov bekor qilindi\n${d}\nKim: ${u.fullName}`);
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
