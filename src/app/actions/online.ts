'use server';
import { audit, hashPassword, passwordProblem } from '@/lib/security';
import { releaseOrderPromo, reservePromo } from '@/lib/promo';
import { notifyTelegram } from '@/lib/payments';
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
      category: ['ai', 'youtube', 'boshqa'].includes(str(fd, 'category') ?? '') ? str(fd, 'category')! : 'ai',
      ...(fd.has('outcomes') ? { outcomes: str(fd, 'outcomes') } : {}),
      ...(fd.has('audience') ? { audience: str(fd, 'audience') } : {}),
      accessDays: int(fd, 'accessDays'),
      updatedAt: new Date(),
    };
    if (v.price < 0 || v.price > 100_000_000) throw new Error("Narx noto'g'ri.");
    if (v.oldPrice !== null && (v.oldPrice < 0 || v.oldPrice > 100_000_000)) throw new Error("Eski narx noto'g'ri.");
    // 0 yoki bo'sh = umrbod; manfiy kun mumkin emas
    if (v.accessDays !== null && (v.accessDays < 0 || v.accessDays > 3650)) throw new Error("Kirish muddati 1–3650 kun bo'lsin (bo'sh = umrbod).");
    if (v.accessDays === 0) v.accessDays = null;
    if (v.coverUrl && !/^https:\/\//.test(v.coverUrl)) throw new Error("Muqova rasmi https:// bilan boshlanishi kerak.");
    if (!/^#[0-9a-fA-F]{6}$/.test(v.color)) v.color = '#008A70';
    if (id) {
      await db.update(onlineCourses).set(v).where(eq(onlineCourses.id, id));
      return { id, message: 'Kurs saqlandi' };
    }
    const [c] = await db.insert(onlineCourses).values({ ...v, status: 'qoralama' }).returning({ id: onlineCourses.id });
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
    await assertSection('online');
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
    const name = req(fd, 'fullName', 'Ism').replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, ' ').slice(0, 80);
    let [l] = await db.select().from(learners).where(eq(learners.phone, phone));
    if (!l) [l] = await db.insert(learners).values({ fullName: name, phone, email: str(fd, 'email'), telegram: str(fd, 'telegram'), source: str(fd, 'source') }).returning();
    const code = str(fd, 'promoCode');
    const q = await priceFor(courseId, code);
    const statusIn = str(fd, 'status') === 'kutilmoqda' ? 'kutilmoqda' : 'tolandi';
    if (statusIn === 'tolandi' && !['rahbar', 'bugalter', 'admin'].includes(u.role)) {
      throw new Error("\"To'langan\" sotuvni rahbar, hisobchi yoki administrator kiritadi. Siz \"To'lov kutilmoqda\" holatida qo'shing.");
    }
    const custom = int(fd, 'amount');
    let amount = q.price;
    if (custom !== null && custom !== q.course.price && custom !== q.price) {
      // Narxni qo'lda o'zgartirish faqat rahbarga ruxsat
      if (u.role !== 'rahbar') throw new Error("Narxni faqat rahbar o'zgartira oladi. Chegirma uchun promokoddan foydalaning.");
      if (custom < 0 || custom > q.course.price * 3) throw new Error("Summa noto'g'ri.");
      amount = custom;
    }
    const [dup] = await db.execute<{ c: number }>(sql`
      select count(*)::int c from course_orders where learner_id = ${l.id} and course_id = ${courseId}
        and (status = 'kutilmoqda' or (status = 'tolandi' and (access_until is null or access_until >= ${today()})))`);
    if (dup.c) throw new Error("Bu o'quvchida shu kurs bo'yicha ochiq yoki to'langan buyurtma bor. Sotuvlar ro'yxatidan o'shani ishlating.");
    const status = statusIn;
    const paidAt = status === 'tolandi' ? str(fd, 'paidAt') || today() : null;
    if (paidAt) {
      // Kelajakdagi yoki juda eski sana bilan "abadiy" ruxsat ochib bo'lmaydi
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || paidAt > today() || paidAt < addDays(today(), -31)) throw new Error("To'lov sanasi noto'g'ri (bugun yoki oxirgi 31 kun ichida bo'lsin).");
    }
    // Promokod band qilish va buyurtma yozish — bitta tranzaksiyada (xato bo'lsa promokod qaytadi)
    await db.transaction(async (tx) => {
    if (q.promo && !(await reservePromo(q.promo.code, courseId, tx))) throw new Error('Promokod limiti tugagan yoki faol emas.');
    await tx.insert(courseOrders).values({
      learnerId: l.id,
      courseId,
      amount,
      originalPrice: q.course.price,
      promoCode: q.promo?.code ?? null,
      promoReserved: !!q.promo,
      method: ['click', 'payme', 'uzum', 'karta', 'naqd', 'bank', 'bepul'].includes(str(fd, 'method') ?? '') ? str(fd, 'method')! : 'karta',
      status,
      paidAt,
      accessUntil: paidAt && q.course.accessDays ? addDays(paidAt, q.course.accessDays) : null,
      note: str(fd, 'note'),
      createdById: u.id,
    });
    });
    if (status === 'tolandi') {
      const d = `${l.fullName} (+${l.phone}) — ${q.course.title}, ${amount} so'm, ${paidAt}`;
      await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Onlayn sotuv qo'lda qayd etildi", detail: d });
      if (u.role !== 'rahbar') await notifyTelegram(`🧾 SmartEdu: ${u.fullName} onlayn kursni qo'lda "to'langan" deb ochdi\n${d}`);
    }
    return { message: status === 'tolandi' ? "Sotuv qayd etildi, kursga ruxsat ochildi" : "Buyurtma qo'shildi, to'lov kutilmoqda" };
  });
}

const TRANSITIONS: Record<string, string[]> = { kutilmoqda: ['tolandi', 'bekor'], tolandi: ['qaytarildi'], qaytarildi: [], bekor: [] };

export async function setOrderStatus(id: number, status: 'tolandi' | 'qaytarildi' | 'bekor') {
  return run(async () => {
    const u = await assertSection('online');
    if (status === 'qaytarildi' && u.role !== 'rahbar') throw new Error("Pulni qaytarishni faqat rahbar tasdiqlaydi.");
    // Pul tushganini faqat rahbar, hisobchi yoki administrator tasdiqlaydi (sotuv/marketing emas)
    if (status === 'tolandi' && !['rahbar', 'bugalter', 'admin'].includes(u.role)) throw new Error("To'lovni rahbar, hisobchi yoki administrator tasdiqlaydi.");
    const [o] = await db.select().from(courseOrders).where(eq(courseOrders.id, id));
    if (!o) throw new Error('Buyurtma topilmadi.');
    if (!TRANSITIONS[o.status]?.includes(status)) throw new Error("Bu buyurtma holatini bunday o'zgartirib bo'lmaydi.");
    if (status === 'tolandi') {
      const [busy] = await db.execute<{ c: number }>(sql`select count(*)::int c from payme_transactions where order_id = ${id} and state = 1`);
      if (busy.c) throw new Error("Bu buyurtma uchun Payme to'lovi jarayonda — kuting.");
      const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, o.courseId));
      const d = today();
      // Atomar: faqat hali kutilayotgan buyurtma to'lanadi (parallel bosish ikki marta hisoblamaydi)
      const done = await db
        .update(courseOrders)
        .set({ status, paidAt: d, accessUntil: c?.accessDays ? addDays(d, c.accessDays) : null })
        .where(and(eq(courseOrders.id, id), eq(courseOrders.status, 'kutilmoqda')))
        .returning({ id: courseOrders.id });
      if (!done.length) throw new Error("Buyurtma holati allaqachon o'zgargan.");
      if (o.promoCode && !o.promoReserved) {
        await db.execute(sql`update promo_codes set used = used + 1 where code = ${o.promoCode}`);
        await db.update(courseOrders).set({ promoReserved: true }).where(eq(courseOrders.id, id));
      }
      await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Onlayn to'lov tasdiqlandi", detail: `buyurtma #${id}, ${o.amount} so'm` });
      if (u.role !== 'rahbar') await notifyTelegram(`✅ SmartEdu: ${u.fullName} onlayn buyurtma #${id} ni "to'landi" deb tasdiqladi (${o.amount} so'm). Pul haqiqatan tushganini tekshiring.`);
      return { message: "To'landi, kursga ruxsat ochildi" };
    }
    const done = await db
      .update(courseOrders)
      .set({ status })
      .where(and(eq(courseOrders.id, id), eq(courseOrders.status, o.status)))
      .returning({ id: courseOrders.id });
    if (!done.length) throw new Error("Buyurtma holati allaqachon o'zgargan.");
    await releaseOrderPromo(id);
    if (status === 'qaytarildi') await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Onlayn buyurtma qaytarildi', detail: `buyurtma #${id}` });
    return { message: status === 'qaytarildi' ? 'Pul qaytarildi, ruxsat yopildi' : 'Buyurtma bekor qilindi' };
  });
}

/* ---------- Onlayn o'quvchilar ---------- */

export async function saveLearner(id: number, fd: FormData) {
  return run(async () => {
    const me = await assertSection('online');
    const [old] = await db.select({ phone: learners.phone, fullName: learners.fullName }).from(learners).where(eq(learners.id, id));
    if (!old) throw new Error("O'quvchi topilmadi.");
    const phone = normalizePhone(req(fd, 'phone', 'Telefon'));
    if (phone.length !== 12) throw new Error("Telefon raqamni to'liq kiriting.");
    const phoneChanged = phone !== old.phone;
    await db
      .update(learners)
      .set({
        fullName: req(fd, 'fullName', 'Ism').replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, ' ').slice(0, 80),
        phone,
        // Raqam o'zgarsa o'quvchining barcha sessiyalari yopiladi
        ...(phoneChanged ? { sessionVersion: sql`${learners.sessionVersion} + 1` } : {}),
        email: str(fd, 'email'),
        telegram: str(fd, 'telegram'),
        city: str(fd, 'city'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
      })
      .where(eq(learners.id, id));
    if (phoneChanged) await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "O'quvchi raqami o'zgartirildi", detail: `${old.fullName}: +${old.phone} → +${phone}` });
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
    const me = await assertSection('onlineEdit');
    // Katta chegirma (90%+ yoki 500 000 so'mdan ortiq) — faqat rahbar yaratadi
    if (me.role !== 'rahbar' && ((type === 'percent' && value >= 90) || (type !== 'percent' && value > 500_000))) {
      throw new Error("Bunday katta chegirmali promokodni faqat rahbar yaratadi.");
    }
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
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: id ? 'Promokod tahrirlandi' : 'Promokod yaratildi', detail: `${code}: ${v.percent ? v.percent + '%' : v.amount + " so'm"}${v.maxUses ? `, ${v.maxUses} marta` : ''}` });
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

export async function setLearnerPassword(id: number, fd: FormData) {
  return run(async () => {
    const me = await assertSection('online');
    const pw = req(fd, 'password', 'Parol');
    const [l] = await db.select({ phone: learners.phone, fullName: learners.fullName, hasPw: learners.passwordHash }).from(learners).where(eq(learners.id, id));
    if (!l) throw new Error("O'quvchi topilmadi.");
    // O'quvchi o'zi qo'ygan parolni faqat rahbar almashtira oladi (hisobni egallab olishning oldini olish)
    if (l.hasPw && me.role !== 'rahbar') throw new Error("O'quvchining o'z paroli bor. Uni faqat rahbar almashtira oladi.");
    const err = passwordProblem(pw, l.phone);
    if (err) throw new Error(err);
    await db.update(learners).set({ passwordHash: await hashPassword(pw), sessionVersion: sql`${learners.sessionVersion} + 1` }).where(eq(learners.id, id));
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "O'quvchiga parol berildi", detail: l.fullName });
    return { message: "Parol o'rnatildi. Uni o'quvchiga yuboring." };
  });
}
