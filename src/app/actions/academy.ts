'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { learners, courseOrders, onlineCourses, promoCodes, courseLessons, lessonProgress } from '@/db/schema';
import { LEARNER_COOKIE, getLearner, setLearnerCookie } from '@/lib/learner';
import { hasAccess } from '@/lib/academy';
import { expireStaleOrders, releaseOrderPromo, reservePromo } from '@/lib/promo';
import { notifyTelegram } from '@/lib/payments';
import { normalizePhone, money } from '@/lib/format';
import { addDays, today } from '@/lib/dates';
import { LOCK_MESSAGE, clearHits, clientIp, guardLogin, hashPassword, isTrustedDevice, rememberDevice, overLimit, passwordProblem, verifyPassword } from '@/lib/security';

export type FormState = { error?: string } | undefined;

/** Faqat o'z saytimiz ichidagi manzilga qaytaramiz (open redirect yo'q) */
function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === 'string' ? n : '';
  return /^\/akademiya(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9\-_=&%]*)?$/.test(s) && !s.includes('//') ? s : '/akademiya/kabinet';
}

export async function registerLearner(_: FormState, fd: FormData): Promise<FormState> {
  const fullName = String(fd.get('fullName') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (fullName.length < 3) return { error: "Ism-familiyangizni to'liq yozing." };
  if (phone.length !== 12) return { error: "Telefon raqamni to'liq kiriting, masalan 90 123 45 67." };
  if (fullName.length > 80) return { error: 'Ism juda uzun.' };
  const pwErr = passwordProblem(password, phone);
  if (pwErr) return { error: pwErr };
  const ip = await clientIp();
  // Bitta IP dan soatiga 5 tadan ortiq ro'yxat — bot hujumi
  if (await overLimit('register', ip, 5, 60)) return { error: LOCK_MESSAGE };
  const [ex] = await db.select().from(learners).where(eq(learners.phone, phone));
  const hash = await hashPassword(password);
  let id: number;
  const v = 0;
  if (ex) {
    // Mavjud raqamni boshqa odam "egallab" ololmasligi uchun: parolni faqat administrator beradi
    // Bitta neytral javob: raqam kimga tegishli ekani (markaz o'quvchisimi) oshkor bo'lmaydi
    return { error: "Bu raqam bilan ro'yxatdan o'tib bo'lmaydi. Hisobingiz bo'lsa \"Kirish\"ni bosing, parol kerak bo'lsa administratorga yozing." };
  } else {
    const [l] = await db.insert(learners).values({ fullName, phone, passwordHash: hash, source: 'Sayt', lastLoginAt: new Date() }).returning({ id: learners.id });
    id = l.id;
  }
  await setLearnerCookie(id, v);
  redirect(safeNext(fd.get('next')));
}

export async function loginLearner(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(String(fd.get('phone') || ''));
  const password = String(fd.get('password') || '');
  if (!phone || !password || password.length > 128) return { error: "Telefon raqam yoki parol noto'g'ri." };
  const ip = await clientIp();
  const g = await guardLogin('learner', phone, ip, await isTrustedDevice('learner', phone));
  if (g.blocked) return { error: LOCK_MESSAGE };
  const [l] = await db.select().from(learners).where(eq(learners.phone, phone));
  if (!(await verifyPassword(password, l?.passwordHash)) || !l) return { error: "Telefon raqam yoki parol noto'g'ri." };
  await g.success();
  await db.update(learners).set({ lastLoginAt: new Date() }).where(eq(learners.id, l.id));
  await setLearnerCookie(l.id, l.sessionVersion);
  await rememberDevice('learner', phone);
  redirect(safeNext(fd.get('next')));
}

export async function logoutLearner() {
  (await cookies()).set(LEARNER_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
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
  // Promokodlarni terib topishga yo'l qo'ymaymiz: 10 daqiqada 10 ta xato
  if (await overLimit('promo', `l:${l.id}`, 20, 10)) return { ok: false as const, error: LOCK_MESSAGE };
  await expireStaleOrders();
  if (typeof code !== 'string' || code.length > 40 || !Number.isInteger(courseId)) return { ok: false as const, error: 'Promokod yaroqsiz.' };
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
  const promoIn = String(fd.get('promo') || '').trim().slice(0, 40) || null;
  if (promoIn && (await overLimit('promo', `l:${l.id}`, 20, 10))) return { error: LOCK_MESSAGE };
  // Bitta o'quvchi soatiga 20 tadan ortiq buyurtma urinishi qila olmaydi
  if (await overLimit('order', `l:${l.id}`, 20, 60)) return { error: LOCK_MESSAGE };
  // Eskirgan band qilingan promokodlar avval bo'shatiladi
  await expireStaleOrders();
  let q;
  try {
    q = await quote(courseId, promoIn);
  } catch (e) {
    return { error: (e as Error).message };
  }
  type Out = { kind: 'free' } | { kind: 'order'; id: number; created: boolean } | { kind: 'error'; error: string };
  const LIMIT = 'Promokod limiti tugagan.';
  const course = q.course;
  const promo = q.promo;
  const price = q.price;
  // Hammasi bitta tranzaksiyada: promokod band qilinib, buyurtma yozilmay qolsa — avtomatik bekor bo'ladi.
  // Bitta o'quvchining shu kursga parallel so'rovlari navbatga qo'yiladi (promokod ikki marta band bo'lmaydi).
  const out: Out = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${l.id}, ${courseId})`);
    const [paid] = await tx.execute<{ c: number }>(sql`
      select count(*)::int c from course_orders where learner_id = ${l.id} and course_id = ${courseId} and status = 'tolandi'
        and (access_until is null or access_until >= ${today()})`);
    if (paid.c) return { kind: 'free' };
    if (price === 0) {
      if (promo && !(await reservePromo(promo, courseId, tx))) return { kind: 'error', error: LIMIT };
      const d = today();
      await tx.insert(courseOrders).values({ learnerId: l.id, courseId, amount: 0, originalPrice: course.price, promoCode: promo, promoReserved: !!promo, method: 'bepul', status: 'tolandi', paidAt: d, accessUntil: course.accessDays ? addDays(d, course.accessDays) : null, provider: 'sayt' });
      return { kind: 'free' };
    }
    // Ochiq (kutilayotgan) buyurtma bo'lsa, o'shani yangilaymiz
    const [open] = await tx
      .select()
      .from(courseOrders)
      .where(and(eq(courseOrders.learnerId, l.id), eq(courseOrders.courseId, courseId), eq(courseOrders.status, 'kutilmoqda')));
    if (open) {
      const [busy] = await tx.execute<{ c: number }>(sql`select count(*)::int c from payme_transactions where order_id = ${open.id} and state = 1`);
      const samePromo = (open.promoCode ?? null) === promo;
      if (!busy.c && !(samePromo && open.amount === price)) {
        if (!samePromo) {
          if (promo && !(await reservePromo(promo, courseId, tx))) return { kind: 'error', error: LIMIT };
          await releaseOrderPromo(open.id, tx);
        }
        await tx
          .update(courseOrders)
          .set({ amount: price, originalPrice: course.price, promoCode: promo, ...(samePromo ? {} : { promoReserved: !!promo }) })
          .where(and(eq(courseOrders.id, open.id), eq(courseOrders.status, 'kutilmoqda')));
      }
      return { kind: 'order', id: open.id, created: false };
    }
    if (promo && !(await reservePromo(promo, courseId, tx))) return { kind: 'error', error: LIMIT };
    const [o] = await tx
      .insert(courseOrders)
      .values({ learnerId: l.id, courseId, amount: price, originalPrice: course.price, promoCode: promo, promoReserved: !!promo, method: 'karta', status: 'kutilmoqda', provider: 'sayt', note: 'Saytdan buyurtma' })
      .returning({ id: courseOrders.id });
    return { kind: 'order', id: o.id, created: true };
  });
  if (out.kind === 'error') return { error: out.error };
  if (out.kind === 'free') redirect(`/akademiya/oqish/${c.slug}`);
  const orderId = out.id;
  if (out.created) await notifyTelegram(`Yangi buyurtma #${orderId}\n${l.fullName}, +${l.phone}\n${course.title}\nSumma: ${money(price)}${promo ? `\nPromokod: ${promo}` : ''}`);
  redirect(`/akademiya/tolov/${orderId}`);
}

/** O'quvchi karta orqali to'laganini bildiradi: admin tekshiradi va tasdiqlaydi */
export async function reportPaid(orderId: number, fd: FormData) {
  const l = await getLearner();
  if (!l) return { ok: false as const, error: 'Avval tizimga kiring.' };
  const [o] = await db.select().from(courseOrders).where(and(eq(courseOrders.id, orderId), eq(courseOrders.learnerId, l.id)));
  if (!o || o.status !== 'kutilmoqda') return { ok: false as const, error: 'Buyurtma topilmadi.' };
  if (await overLimit('report', `l:${l.id}`, 5, 60)) return { ok: false as const, error: LOCK_MESSAGE };
  const note = String(fd.get('note') || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200);
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
  const fullName = String(fd.get('fullName') || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (fullName.length < 3) return { error: "Ismni to'liq yozing." };
  const next = String(fd.get('next') || '');
  const set: Record<string, unknown> = { fullName, email: String(fd.get('email') || '').trim() || null, telegram: String(fd.get('telegram') || '').trim() || null };
  if (next) {
    if (await overLimit('learner-pw', `l:${l.id}`, 5, 15)) return { error: LOCK_MESSAGE };
    const [row] = await db.select().from(learners).where(eq(learners.id, l.id));
    if (!(await verifyPassword(String(fd.get('current') || ''), row?.passwordHash))) return { error: "Joriy parol noto'g'ri." };
    await clearHits('learner-pw', `l:${l.id}`);
    const err = passwordProblem(next, l.phone);
    if (err) return { error: err };
    set.passwordHash = await hashPassword(next);
    set.sessionVersion = sql`${learners.sessionVersion} + 1`;
  }
  if (fullName.length > 80 || String(set.email ?? '').length > 120 || String(set.telegram ?? '').length > 64) return { error: "Ma'lumot juda uzun." };
  const [upd] = await db.update(learners).set(set).where(eq(learners.id, l.id)).returning({ v: learners.sessionVersion });
  // Parol almashsa: boshqa qurilmalar chiqib ketadi, joriy qurilma qoladi
  if (next) await setLearnerCookie(l.id, upd.v);
  return { error: undefined };
}
