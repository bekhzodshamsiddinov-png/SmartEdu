'use server';
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { onlineCourses, courseModules, courseLessons, learners, courseOrders, promoCodes } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { addDays, today } from '@/lib/dates';

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[ʻʼ'`‘’]/g, '')
      .replace(/sh/g, 'sh')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'kurs'
  );
}

/* ---------- Kurslar ---------- */

export async function saveOnlineCourse(id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('onlineEdit');
    const title = req(fd, 'title', 'Kurs nomi');
    let slug = slugify(str(fd, 'slug') || title);
    const clash = await db.select({ id: onlineCourses.id }).from(onlineCourses).where(eq(onlineCourses.slug, slug));
    if (clash.length && clash[0].id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const v = {
      title,
      slug,
      subtitle: str(fd, 'subtitle'),
      description: str(fd, 'description'),
      level: str(fd, 'level') || 'boshlangich',
      price: int(fd, 'price') ?? 0,
      oldPrice: int(fd, 'oldPrice'),
      coverUrl: str(fd, 'coverUrl'),
      color: str(fd, 'color') || '#008A70',
      status: str(fd, 'status') || 'qoralama',
      accessDays: int(fd, 'accessDays'),
      updatedAt: new Date(),
    };
    if (id) {
      await db.update(onlineCourses).set(v).where(eq(onlineCourses.id, id));
      return { id, message: 'Kurs saqlandi' };
    }
    const [c] = await db.insert(onlineCourses).values(v).returning({ id: onlineCourses.id });
    await db.insert(courseModules).values({ courseId: c.id, title: '1-modul. Kirish', position: 0 });
    return { id: c.id, message: 'Kurs yaratildi' };
  });
}

export async function setCourseStatus(id: number, status: 'qoralama' | 'sotuvda' | 'yopiq') {
  return run(async () => {
    await assertSection('onlineEdit');
    if (status === 'sotuvda') {
      const [n] = await db.select({ c: sql<number>`count(*)::int` }).from(courseLessons).where(eq(courseLessons.courseId, id));
      if (!n.c) throw new Error("Sotuvga chiqarishdan oldin kamida bitta dars qo'shing.");
    }
    await db.update(onlineCourses).set({ status, updatedAt: new Date() }).where(eq(onlineCourses.id, id));
    return { message: status === 'sotuvda' ? 'Kurs sotuvga chiqarildi' : status === 'yopiq' ? 'Kurs yopildi' : 'Qoralamaga qaytarildi' };
  });
}

export async function deleteOnlineCourse(id: number) {
  return run(async () => {
    const u = await assertSection('onlineEdit');
    if (u.role !== 'rahbar') throw new Error("Kursni faqat rahbar o'chiradi.");
    const [n] = await db.select({ c: sql<number>`count(*)::int` }).from(courseOrders).where(eq(courseOrders.courseId, id));
    if (n.c) throw new Error("Bu kursda sotuvlar bor. O'chirish o'rniga \"Yopish\" ni tanlang.");
    await db.delete(onlineCourses).where(eq(onlineCourses.id, id));
    return { message: "Kurs o'chirildi" };
  });
}

/* ---------- Modullar ---------- */

export async function saveModule(courseId: number, id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('onlineEdit');
    const title = req(fd, 'title', 'Modul nomi');
    if (id) await db.update(courseModules).set({ title }).where(eq(courseModules.id, id));
    else {
      const [m] = await db.select({ p: sql<number>`coalesce(max(position), -1)::int` }).from(courseModules).where(eq(courseModules.courseId, courseId));
      await db.insert(courseModules).values({ courseId, title, position: m.p + 1 });
    }
    return { message: id ? 'Modul nomi yangilandi' : "Modul qo'shildi" };
  });
}

export async function deleteModule(id: number) {
  return run(async () => {
    await assertSection('onlineEdit');
    await db.delete(courseModules).where(eq(courseModules.id, id));
    return { message: "Modul o'chirildi" };
  });
}

export async function moveModule(id: number, dir: -1 | 1) {
  return run(async () => {
    await assertSection('onlineEdit');
    const [m] = await db.select().from(courseModules).where(eq(courseModules.id, id));
    if (!m) throw new Error('Modul topilmadi.');
    const [other] = await db
      .select()
      .from(courseModules)
      .where(and(eq(courseModules.courseId, m.courseId), dir < 0 ? lt(courseModules.position, m.position) : gt(courseModules.position, m.position)))
      .orderBy(dir < 0 ? desc(courseModules.position) : asc(courseModules.position))
      .limit(1);
    if (!other) return { message: 'Joyida' };
    await db.update(courseModules).set({ position: other.position }).where(eq(courseModules.id, m.id));
    await db.update(courseModules).set({ position: m.position }).where(eq(courseModules.id, other.id));
    return { message: "Tartib o'zgardi" };
  });
}

/* ---------- Darslar ---------- */

export async function saveLesson(moduleId: number, id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('onlineEdit');
    const [m] = await db.select().from(courseModules).where(eq(courseModules.id, moduleId));
    if (!m) throw new Error('Modul topilmadi.');
    const v = {
      title: req(fd, 'title', 'Dars nomi'),
      kind: str(fd, 'kind') || 'video',
      videoUrl: str(fd, 'videoUrl'),
      durationMin: int(fd, 'durationMin'),
      content: str(fd, 'content'),
      isFree: bool(fd, 'isFree'),
      published: !fd.has('draftMarker') || bool(fd, 'published'),
      moduleId,
      courseId: m.courseId,
    };
    if (v.kind === 'video' && v.videoUrl && !/^https?:\/\//.test(v.videoUrl)) throw new Error("Video havolasi https:// bilan boshlanishi kerak.");
    if (id) await db.update(courseLessons).set(v).where(eq(courseLessons.id, id));
    else {
      const [p] = await db.select({ p: sql<number>`coalesce(max(position), -1)::int` }).from(courseLessons).where(eq(courseLessons.moduleId, moduleId));
      await db.insert(courseLessons).values({ ...v, position: p.p + 1 });
    }
    await db.update(onlineCourses).set({ updatedAt: new Date() }).where(eq(onlineCourses.id, m.courseId));
    return { message: id ? 'Dars saqlandi' : "Dars qo'shildi" };
  });
}

export async function deleteLesson(id: number) {
  return run(async () => {
    await assertSection('onlineEdit');
    await db.delete(courseLessons).where(eq(courseLessons.id, id));
    return { message: "Dars o'chirildi" };
  });
}

export async function moveLesson(id: number, dir: -1 | 1) {
  return run(async () => {
    await assertSection('onlineEdit');
    const [l] = await db.select().from(courseLessons).where(eq(courseLessons.id, id));
    if (!l) throw new Error('Dars topilmadi.');
    const [other] = await db
      .select()
      .from(courseLessons)
      .where(and(eq(courseLessons.moduleId, l.moduleId), dir < 0 ? lt(courseLessons.position, l.position) : gt(courseLessons.position, l.position)))
      .orderBy(dir < 0 ? desc(courseLessons.position) : asc(courseLessons.position))
      .limit(1);
    if (!other) return { message: 'Joyida' };
    await db.update(courseLessons).set({ position: other.position }).where(eq(courseLessons.id, l.id));
    await db.update(courseLessons).set({ position: l.position }).where(eq(courseLessons.id, other.id));
    return { message: "Tartib o'zgardi" };
  });
}

/* ---------- Narx va promokod ---------- */

async function priceFor(courseId: number, code: string | null) {
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, courseId));
  if (!c) throw new Error('Kurs topilmadi.');
  if (!code) return { course: c, price: c.price, discount: 0, promo: null as null | typeof promoCodes.$inferSelect };
  const [p] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.trim().toUpperCase()));
  if (!p || !p.active) throw new Error('Promokod topilmadi yoki faol emas.');
  if (p.validUntil && p.validUntil < today()) throw new Error('Promokod muddati tugagan.');
  if (p.maxUses !== null && p.used >= p.maxUses) throw new Error('Promokod limiti tugagan.');
  if (p.courseId && p.courseId !== courseId) throw new Error('Bu promokod boshqa kurs uchun.');
  const discount = p.percent ? Math.round((c.price * p.percent) / 100) : Math.min(c.price, p.amount ?? 0);
  return { course: c, price: Math.max(0, c.price - discount), discount, promo: p };
}

export async function quotePrice(courseId: number, code: string) {
  try {
    const r = await priceFor(courseId, code || null);
    return { ok: true as const, price: r.price, discount: r.discount, original: r.course.price };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/* ---------- Sotuvlar ---------- */

export async function createOrder(fd: FormData) {
  return run(async () => {
    const u = await assertSection('online');
    const courseId = int(fd, 'courseId');
    if (!courseId) throw new Error('Kursni tanlang.');
    const phone = normalizePhone(req(fd, 'phone', 'Telefon'));
    if (phone.length < 9) throw new Error("Telefon raqamni to'liq kiriting.");
    const name = req(fd, 'fullName', 'Ism');
    let [l] = await db.select().from(learners).where(eq(learners.phone, phone));
    if (!l) [l] = await db.insert(learners).values({ fullName: name, phone, email: str(fd, 'email'), telegram: str(fd, 'telegram'), source: str(fd, 'source') }).returning();
    const code = str(fd, 'promoCode');
    const q = await priceFor(courseId, code);
    const custom = int(fd, 'amount');
    const amount = custom !== null && custom !== q.course.price ? custom : q.price;
    const status = str(fd, 'status') === 'kutilmoqda' ? 'kutilmoqda' : 'tolandi';
    const paidAt = status === 'tolandi' ? str(fd, 'paidAt') || today() : null;
    await db.insert(courseOrders).values({
      learnerId: l.id,
      courseId,
      amount,
      originalPrice: q.course.price,
      promoCode: q.promo?.code ?? null,
      method: str(fd, 'method') || 'click',
      status,
      paidAt,
      accessUntil: paidAt && q.course.accessDays ? addDays(paidAt, q.course.accessDays) : null,
      note: str(fd, 'note'),
      createdById: u.id,
    });
    if (q.promo) await db.update(promoCodes).set({ used: sql`${promoCodes.used} + 1` }).where(eq(promoCodes.id, q.promo.id));
    return { message: status === 'tolandi' ? "Sotuv qayd etildi, kursga ruxsat ochildi" : "Buyurtma qo'shildi, to'lov kutilmoqda" };
  });
}

export async function setOrderStatus(id: number, status: 'tolandi' | 'qaytarildi' | 'bekor') {
  return run(async () => {
    const u = await assertSection('online');
    if (status === 'qaytarildi' && u.role !== 'rahbar') throw new Error("Pulni qaytarishni faqat rahbar tasdiqlaydi.");
    const [o] = await db.select().from(courseOrders).where(eq(courseOrders.id, id));
    if (!o) throw new Error('Buyurtma topilmadi.');
    if (status === 'tolandi') {
      const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, o.courseId));
      const d = today();
      await db.update(courseOrders).set({ status, paidAt: d, accessUntil: c?.accessDays ? addDays(d, c.accessDays) : null }).where(eq(courseOrders.id, id));
      return { message: "To'landi, kursga ruxsat ochildi" };
    }
    await db.update(courseOrders).set({ status }).where(eq(courseOrders.id, id));
    return { message: status === 'qaytarildi' ? 'Pul qaytarildi, ruxsat yopildi' : 'Buyurtma bekor qilindi' };
  });
}

/* ---------- Onlayn o'quvchilar ---------- */

export async function saveLearner(id: number, fd: FormData) {
  return run(async () => {
    await assertSection('online');
    await db
      .update(learners)
      .set({
        fullName: req(fd, 'fullName', 'Ism'),
        phone: normalizePhone(req(fd, 'phone', 'Telefon')),
        email: str(fd, 'email'),
        telegram: str(fd, 'telegram'),
        city: str(fd, 'city'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
      })
      .where(eq(learners.id, id));
    return { message: "Ma'lumotlar saqlandi" };
  });
}

/* ---------- Promokodlar ---------- */

export async function savePromo(id: number | null, fd: FormData) {
  return run(async () => {
    await assertSection('onlineEdit');
    const code = req(fd, 'code', 'Kod').toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("Kod 3–20 ta lotin harf yoki raqamdan iborat bo'lsin.");
    const type = str(fd, 'type');
    const value = int(fd, 'value');
    if (!value || value <= 0) throw new Error("Chegirma miqdorini kiriting.");
    if (type === 'percent' && value > 100) throw new Error("Foiz 100 dan oshmasin.");
    const v = {
      code,
      percent: type === 'percent' ? value : null,
      amount: type === 'percent' ? null : value,
      courseId: int(fd, 'courseId'),
      maxUses: int(fd, 'maxUses'),
      validUntil: str(fd, 'validUntil'),
    };
    if (id) await db.update(promoCodes).set(v).where(eq(promoCodes.id, id));
    else await db.insert(promoCodes).values(v);
    return { message: id ? 'Promokod saqlandi' : 'Promokod yaratildi' };
  });
}

export async function togglePromo(id: number) {
  return run(async () => {
    await assertSection('onlineEdit');
    const [p] = await db.select().from(promoCodes).where(eq(promoCodes.id, id));
    if (!p) throw new Error('Topilmadi.');
    await db.update(promoCodes).set({ active: !p.active }).where(eq(promoCodes.id, id));
    return { message: p.active ? "Promokod o'chirildi" : 'Promokod yoqildi' };
  });
}
