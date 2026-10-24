'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { learners, courseOrders, onlineCourses, promoCodes, courseLessons, lessonProgress } from '@/db/schema';
import { LEARNER_COOKIE, getLearner, setLearnerCookie } from '@/lib/learner';
import { hasAccess } from '@/lib/academy';
import { notifyTelegram } from '@/lib/payments';
import { normalizePhone, money } from '@/lib/format';
import { addDays, today } from '@/lib/dates';

export type FormState = { error?: string } | undefined;

function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === 'string' ? n : '';
  return s.startsWith('/akademiya') ? s : '/akademiya/kabinet';
}

export async function registerLearner(_: FormState, fd: FormData): Promise<FormState> {
  const fullName = String(fd.get('fullName') || '').trim();
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (fullName.length < 3) return { error: "Ism-familiyangizni to'liq yozing." };
  if (phone.length !== 12) return { error: "Telefon raqamni to'liq kiriting, masalan 90 123 45 67." };
  if (password.length < 6) return { error: "Parol kamida 6 belgidan iborat bo'lsin." };
  const [ex] = await db.select().from(learners).where(eq(learners.phone, phone));
  const hash = await bcrypt.hash(password, 10);
  let id: number;
  if (ex) {
    if (ex.passwordHash) return { error: "Bu raqam ro'yxatdan o'tgan. \"Kirish\" bo'limidan foydalaning." };
    const [paid] = await db.select({ c: sql<number>`count(*)::int` }).from(courseOrders).where(and(eq(courseOrders.learnerId, ex.id), eq(courseOrders.status, 'tolandi')));
    if (paid.c > 0) return { error: "Bu raqamga kurs rasmiylashtirilgan. Parolni administratordan oling." };
    await db.update(learners).set({ fullName, passwordHash: hash, lastLoginAt: new Date() }).where(eq(learners.id, ex.id));
    id = ex.id;
  } else {
    const [l] = await db.insert(learners).values({ fullName, phone, passwordHash: hash, source: 'Sayt', lastLoginAt: new Date() }).returning({ id: learners.id });
    id = l.id;
  }
  await setLearnerCookie(id);
  redirect(safeNext(fd.get('next')));
}

export async function loginLearner(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  const [l] = await db.select().from(learners).where(eq(learners.phone, phone));
  if (!l || !l.passwordHash || !(await bcrypt.compare(password, l.passwordHash))) return { error: "Telefon raqam yoki parol noto'g'ri." };
  await db.update(learners).set({ lastLoginAt: new Date() }).where(eq(learners.id, l.id));
  await setLearnerCookie(l.id);
  redirect(safeNext(fd.get('next')));
}

export async function logoutLearner() {
  (await cookies()).delete(LEARNER_COOKIE);
  redirect('/akademiya');
}

async function quote(courseId: number, code: string | null) {
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, courseId));
  if (!c || c.status !== 'sotuvda') throw new Error('Kurs sotuvda emas.');
  if (!code) return { course: c, price: c.price, promo: null as string | null };
  const [p] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.trim().toUpperCase()));
  if (!p || !p.active || (p.validUntil && p.validUntil < today()) || (p.maxUses !== null && p.used >= p.maxUses) || (p.courseId && p.courseId !== courseId))
    throw new Error('Promokod yaroqsiz yoki muddati tugagan.');
  const discount = p.percent ? Math.round((c.price * p.percent) / 100) : Math.min(c.price, p.amount ?? 0);
  return { course: c, price: Math.max(0, c.price - discount), promo: p.code };
}

export async function checkPromo(courseId: number, code: string) {
  const l = await getLearner();
  if (!l) return { ok: false as const, error: 'Avval tizimga kiring.' };
  try {
    const q = await quote(courseId, code);
    return { ok: true as const, price: q.price, original: q.course.price };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function buyCourse(_: FormState, fd: FormData): Promise<FormState> {
  const l = await getLearner();
  const courseId = Number(fd.get('courseId'));
  const [c] = courseId ? await db.select({ slug: onlineCourses.slug }).from(onlineCourses).where(eq(onlineCourses.id, courseId)) : [];
  if (!c) return { error: 'Kurs topilmadi.' };
  if (!l) redirect(`/akademiya/kirish?next=${encodeURIComponent(`/akademiya/kurs/${c.slug}`)}`);
  if (await hasAccess(l.id, courseId)) redirect(`/akademiya/oqish/${c.slug}`);
  let q;
  try {
    q = await quote(courseId, String(fd.get('promo') || '').trim() || null);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (q.price === 0) {
    const d = today();
    await db.insert(courseOrders).values({ learnerId: l.id, courseId, amount: 0, originalPrice: q.course.price, promoCode: q.promo, method: 'bepul', status: 'tolandi', paidAt: d, accessUntil: q.course.accessDays ? addDays(d, q.course.accessDays) : null, provider: 'sayt' });
    if (q.promo) await db.execute(sql`update promo_codes set used = used + 1 where code = ${q.promo}`);
    redirect(`/akademiya/oqish/${c.slug}`);
  }
  // Ochiq (kutilayotgan) buyurtma bo'lsa, o'shani yangilaymiz
  const [open] = await db
    .select()
    .from(courseOrders)
    .where(and(eq(courseOrders.learnerId, l.id), eq(courseOrders.courseId, courseId), eq(courseOrders.status, 'kutilmoqda')));
  let orderId: number;
  if (open) {
    const [busy] = await db.execute<{ c: number }>(sql`select count(*)::int c from payme_transactions where order_id = ${open.id} and state = 1`);
    if (!busy.c) await db.update(courseOrders).set({ amount: q.price, originalPrice: q.course.price, promoCode: q.promo }).where(eq(courseOrders.id, open.id));
    orderId = open.id;
  } else {
    const [o] = await db
      .insert(courseOrders)
      .values({ learnerId: l.id, courseId, amount: q.price, originalPrice: q.course.price, promoCode: q.promo, method: 'karta', status: 'kutilmoqda', provider: 'sayt', note: 'Saytdan buyurtma' })
      .returning({ id: courseOrders.id });
    orderId = o.id;
    await notifyTelegram(`Yangi buyurtma #${orderId}\n${l.fullName}, +${l.phone}\n${q.course.title}\nSumma: ${money(q.price)}${q.promo ? `\nPromokod: ${q.promo}` : ''}`);
  }
  redirect(`/akademiya/tolov/${orderId}`);
}

/** O'quvchi karta orqali to'laganini bildiradi: admin tekshiradi va tasdiqlaydi */
export async function reportPaid(orderId: number, fd: FormData) {
  const l = await getLearner();
  if (!l) return { ok: false as const, error: 'Avval tizimga kiring.' };
  const [o] = await db.select().from(courseOrders).where(and(eq(courseOrders.id, orderId), eq(courseOrders.learnerId, l.id)));
  if (!o || o.status !== 'kutilmoqda') return { ok: false as const, error: 'Buyurtma topilmadi.' };
  const note = String(fd.get('note') || '').slice(0, 200);
  await db.update(courseOrders).set({ method: 'karta', note: `O'quvchi to'laganini bildirdi${note ? `: ${note}` : ''}` }).where(eq(courseOrders.id, orderId));
  await notifyTelegram(`To'lov bildirildi, tekshiring: buyurtma #${orderId}\n${l.fullName}, +${l.phone}\nSumma: ${money(o.amount)}${note ? `\nIzoh: ${note}` : ''}`);
  return { ok: true as const };
}

export async function completeLesson(lessonId: number) {
  const l = await getLearner();
  if (!l) return { ok: false as const };
  const [les] = await db.select({ courseId: courseLessons.courseId, isFree: courseLessons.isFree }).from(courseLessons).where(eq(courseLessons.id, lessonId));
  if (!les || !(await hasAccess(l.id, les.courseId))) return { ok: false as const };
  await db.insert(lessonProgress).values({ learnerId: l.id, lessonId }).onConflictDoNothing();
  return { ok: true as const };
}

export async function uncompleteLesson(lessonId: number) {
  const l = await getLearner();
  if (!l) return { ok: false as const };
  await db.delete(lessonProgress).where(and(eq(lessonProgress.learnerId, l.id), eq(lessonProgress.lessonId, lessonId)));
  return { ok: true as const };
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const l = await getLearner();
  if (!l) return { error: 'Avval tizimga kiring.' };
  const fullName = String(fd.get('fullName') || '').trim();
  if (fullName.length < 3) return { error: "Ismni to'liq yozing." };
  const next = String(fd.get('next') || '');
  const set: Record<string, unknown> = { fullName, email: String(fd.get('email') || '').trim() || null, telegram: String(fd.get('telegram') || '').trim() || null };
  if (next) {
    const [row] = await db.select().from(learners).where(eq(learners.id, l.id));
    if (!row?.passwordHash || !(await bcrypt.compare(String(fd.get('current') || ''), row.passwordHash))) return { error: "Joriy parol noto'g'ri." };
    if (next.length < 6) return { error: "Yangi parol kamida 6 belgi bo'lsin." };
    set.passwordHash = await bcrypt.hash(next, 10);
  }
  await db.update(learners).set(set).where(eq(learners.id, l.id));
  return { error: undefined };
}
