import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { today } from './dates';

const MSG = "O'quvchida amaldagi abonement bor. Avval Abonementlar bo'limida uni bekor qiling (ishlatilmagan qismi hisobga qaytadi).";

/** Guruhdan chiqarish, muzlatish, ketish va bitirishdan oldin: amaldagi abonement qolib ketmasin (aks holda ikki marta to'lov) */
export async function assertNoActiveSubscription(opts: { studentId?: number; enrollmentId?: number }) {
  const [r] = await db.execute<{ c: number }>(sql`
    select count(*)::int c from student_subscriptions ss
    where ss.status = 'faol' and ss.end_date >= ${today()}
      ${opts.studentId ? sql`and ss.student_id = ${opts.studentId}` : sql``}
      ${opts.enrollmentId ? sql`and ss.enrollment_id = ${opts.enrollmentId}` : sql``}`);
  if (r?.c) throw new Error(MSG);
}

/**
 * Guruh almashtirilganda amaldagi abonement yangi guruh yozuviga o'tkaziladi.
 * Paket boshqa yo'nalish uchun bo'lsa yoki darslik abonement "oylik" guruhga o'tsa — ko'chirish to'xtatiladi.
 */
export async function moveSubscriptions(oldEnrollmentId: number, newGroupId: number) {
  const subs = await db.execute<{ id: number; kind: string; course_id: number | null }>(sql`
    select ss.id, ss.kind, p.course_id from student_subscriptions ss left join subscription_plans p on p.id = ss.plan_id
    where ss.enrollment_id = ${oldEnrollmentId} and ss.status = 'faol' and ss.end_date >= ${today()}`);
  if (!subs.length) return [] as number[];
  const [g] = await db.execute<{ course_id: number; billing: string }>(sql`select course_id, billing from groups where id = ${newGroupId}`);
  for (const s of subs) {
    if (s.course_id && s.course_id !== g?.course_id) throw new Error("Abonement boshqa yo'nalish uchun — avval uni bekor qiling.");
    if (s.kind === 'dars' && g?.billing !== 'dars') throw new Error('Darslik abonementni faqat "dars bo\'yicha" guruhga ko\'chirish mumkin.');
    if (s.kind === 'oy' && g?.billing === 'dars') throw new Error('Oylik abonementni "dars bo\'yicha" guruhga ko\'chirib bo\'lmaydi — avval uni bekor qiling.');
  }
  return subs.map((s) => s.id);
}
