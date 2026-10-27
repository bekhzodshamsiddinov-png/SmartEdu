'use server';
import { and, eq, sql } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/db';
import { charges, enrollments, groups, payments, studentSubscriptions, students, subscriptionPlans } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { assertBranch } from '@/lib/branch';
import { addDays, addMonths, monthEnd, today } from '@/lib/dates';
import { audit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';
import { money } from '@/lib/format';
import { cashboxForUser } from '@/lib/cashbox';
import { syncLessonCharges, ensureMonthlyCharges } from '@/lib/billing';
import { enqueue, flushOutbox } from '@/lib/messaging';
import { studentBalance } from '@/lib/finance';

const isDate = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const MAX = 200_000_000;

/** Abonement paketi (rahbar) */
export async function savePlan(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('subscriptions');
    if (u.role !== 'rahbar') throw new Error('Abonement paketlarini rahbar belgilaydi.');
    const kind = str(fd, 'kind') === 'dars' ? 'dars' : 'oy';
    const price = int(fd, 'price');
    if (!price || price <= 0 || price > MAX) throw new Error("Narxni to'g'ri kiriting.");
    const oldPrice = int(fd, 'oldPrice');
    const months = Math.min(24, Math.max(1, int(fd, 'months') ?? 1));
    const lessons = Math.min(300, Math.max(1, int(fd, 'lessons') ?? 12));
    const validDays = Math.min(730, Math.max(7, int(fd, 'validDays') ?? 60));
    const color = /^#[0-9a-fA-F]{6}$/.test(str(fd, 'color') ?? '') ? str(fd, 'color')! : '#D93A08';
    const v = {
      name: req(fd, 'name', 'Nomi').slice(0, 60),
      courseId: int(fd, 'courseId'),
      kind,
      months,
      lessons,
      validDays,
      price,
      oldPrice: oldPrice && oldPrice > price && oldPrice <= MAX ? oldPrice : null,
      description: str(fd, 'description')?.slice(0, 200) ?? null,
      color,
      popular: fd.get('popular') === 'on',
      active: id ? fd.get('active') === 'on' : true,
    };
    if (id) await db.update(subscriptionPlans).set(v).where(eq(subscriptionPlans.id, id));
    else await db.insert(subscriptionPlans).values(v);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: id ? 'Abonement paketi tahrirlandi' : 'Abonement paketi qo\'shildi', detail: `${v.name}: ${money(price)}` });
    return { message: 'Paket saqlandi' };
  });
}

/**
 * Abonement sotish: o'quvchining guruhiga bog'lanadi. "Oy" abonementi qoplagan oylar uchun
 * oylik to'lov yechilmaydi; "dars" abonementi darslarni abonementdan yechadi.
 * Xohlansa shu zahoti to'lov ham qabul qilinadi.
 */
export async function sellSubscription(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('subscriptions');
    if (u.role !== 'rahbar' && u.role !== 'admin') throw new Error('Abonementni rahbar yoki administrator rasmiylashtiradi.');
    await assertBranch('student', studentId);
    const planId = int(fd, 'planId');
    const enrollmentId = int(fd, 'enrollmentId');
    if (!planId || !enrollmentId) throw new Error('Paket va guruhni tanlang.');
    const [p] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.active, true)));
    if (!p) throw new Error('Paket topilmadi.');
    const [e] = await db
      .select({ id: enrollments.id, groupId: enrollments.groupId, billing: groups.billing, courseId: groups.courseId, group: groups.name })
      .from(enrollments)
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.studentId, studentId), eq(enrollments.active, true)));
    if (!e) throw new Error("O'quvchi bu guruhda o'qimaydi.");
    if (p.courseId && p.courseId !== e.courseId) throw new Error("Bu paket boshqa yo'nalish uchun.");
    if (p.kind === 'dars' && e.billing !== 'dars') throw new Error('Darslik abonement faqat "dars bo\'yicha" hisoblanadigan guruhlar uchun.');
    const start = str(fd, 'startDate') || today();
    // O'tgan sanadan boshlash (allaqachon hisoblangan oyni almashtirish) faqat rahbarga, 31 kungacha; boshqalarga 7 kungacha
    const back = u.role === 'rahbar' ? 31 : 7;
    if (!isDate(start) || start < addDays(today(), -back) || start > addDays(today(), 90)) throw new Error(`Boshlanish sanasi bugundan ${back} kun oldin va 90 kun keyin oralig'ida bo'lsin.`);
    const end = p.kind === 'oy' ? monthEnd(addMonths(start.slice(0, 7), p.months - 1)) : addDays(start, p.validDays - 1);
    const pay = fd.get('pay') === 'on';
    const method = (str(fd, 'method') || 'naqd') as 'naqd' | 'click' | 'payme' | 'karta' | 'bank';
    if (pay && !['naqd', 'click', 'payme', 'karta', 'bank'].includes(method)) throw new Error("To'lov usuli noto'g'ri.");
    const [st] = await db.select({ b: students.branchId, name: students.fullName }).from(students).where(eq(students.id, studentId));
    const box = pay ? await cashboxForUser(u.id) : null;
    let subId = 0;
    const chargeDate = start < today() ? start : today();
    await db.transaction(async (tx) => {
      // Bir guruh yozuvi bo'yicha sotuvlar navbat bilan: ikki marta bosilsa ham ikkita abonement bo'lmaydi
      await tx.execute(sql`select pg_advisory_xact_lock(7703, ${e.id})`);
      const [clash] = await tx.execute<{ c: number }>(sql`
        select count(*)::int c from student_subscriptions where enrollment_id = ${e.id} and status in ('faol','toxtatildi')
          and start_date <= ${end} and end_date >= ${start}`);
      if (clash.c) throw new Error('Bu guruhda shu davrga abonement allaqachon bor.');
      const [s] = await tx
        .insert(studentSubscriptions)
        .values({ studentId, planId: p.id, enrollmentId: e.id, name: p.name, kind: p.kind, startDate: start, endDate: end, lessonsTotal: p.kind === 'dars' ? p.lessons : 0, price: p.price, createdById: u.id })
        .returning({ id: studentSubscriptions.id });
      subId = s.id;
      await tx.insert(charges).values({ studentId, enrollmentId: e.id, groupId: e.groupId, kind: 'abonement', amount: p.price, date: chargeDate, month: chargeDate.slice(0, 7), subscriptionId: s.id, note: p.name, createdById: u.id });
      if (p.kind === 'oy') {
        // Qoplangan oylarning alohida oylik va dars yechimlari olib tashlanadi — abonement ularning o'rnini bosadi
        await tx.execute(sql`delete from charges where enrollment_id = ${e.id} and kind = 'oylik' and month between ${start.slice(0, 7)} and ${end.slice(0, 7)}`);
        await tx.execute(sql`delete from charges where enrollment_id = ${e.id} and kind = 'dars' and date >= ${start} and month <= ${end.slice(0, 7)}`);
      }
      if (pay)
        await tx.insert(payments).values({ studentId, enrollmentId: e.id, amount: p.price, method, forMonth: start.slice(0, 7), paidAt: today(), note: `Abonement: ${p.name}`, receivedById: u.id, branchId: st?.b ?? null, cashboxId: box!.id });
    });
    // Parallel ishlagan oylik hisob qoplangan oyga yozuv qo'shgan bo'lsa — olib tashlanadi
    if (p.kind === 'oy') await db.execute(sql`delete from charges where enrollment_id = ${e.id} and kind = 'oylik' and month between ${start.slice(0, 7)} and ${end.slice(0, 7)}`);
    // O'tgan sanadan boshlangan bo'lsa — shu davrdagi darslar qayta hisoblanadi
    if (e.billing === 'dars') {
      const dates = await db.execute<{ d: string }>(sql`select distinct date::text d from attendance where group_id = ${e.groupId} and student_id = ${studentId} and date between ${start.slice(0, 7) + '-01'} and ${today()} order by 1`);
      for (const r of dates) await syncLessonCharges(e.groupId, r.d, u.id);
    }
    await ensureMonthlyCharges(true);
    const d = `${st?.name}: ${p.name}, ${money(p.price)} (${start} — ${end})${pay ? `, to'landi (${method})` : ''}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Abonement sotildi', detail: d });
    if (pay) {
      const bal = await studentBalance(studentId);
      await enqueue('tolov', studentId, { summa: money(p.price), qoldiq: bal < 0 ? `qarz ${money(-bal)}` : money(bal) }, `subpay:${subId}`);
      after(() => flushOutbox(10).catch(() => 0));
    }
    return { id: subId, message: 'Abonement rasmiylashtirildi' };
  });
}

/**
 * Abonementni bekor qilish.
 *  - "toliq": abonement butunlay bekor, narxi hisobga qaytariladi, oddiy hisob tiklanadi.
 *  - "sanadan": tanlangan sanadan to'xtaydi; ishlatilmagan qismi qaytariladi
 *    (oylik — sana oyidan keyingi to'liq oylar; darslik — ishlatilmagan darslar).
 * Qaytariladigan summa o'quvchi hisobiga tushadi (tuzatish yozuvi), naqd qaytarish alohida rasmiylashtiriladi.
 */
export async function cancelSubscription(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('subscriptions');
    if (u.role !== 'rahbar' && u.role !== 'admin') throw new Error('Abonementni rahbar yoki administrator bekor qiladi.');
    const [s] = await db.select().from(studentSubscriptions).where(eq(studentSubscriptions.id, id));
    if (!s) throw new Error('Abonement topilmadi.');
    await assertBranch('student', s.studentId);
    if (s.status !== 'faol') throw new Error('Abonement allaqachon bekor qilingan yoki to\'xtatilgan.');
    const reason = req(fd, 'reason', 'Sabab').slice(0, 200);
    const mode = str(fd, 'mode') === 'toliq' ? 'toliq' : 'sanadan';
    let refund = 0;
    let newEnd = s.endDate;
    let lessonsTotal = s.lessonsTotal;
    const [usedNow] = await db.execute<{ c: number }>(sql`select count(*)::int c from charges where subscription_id = ${s.id} and kind = 'abonement_dars'`);
    if (mode === 'toliq') {
      // To'liq qaytarish faqat ishlatilmagan abonement uchun (aks holda o'tgan davr boshqa narxda qayta hisoblanib, hisob buziladi)
      if (u.role !== 'rahbar') throw new Error("To'liq qaytarishni rahbar bajaradi.");
      if ((s.kind === 'oy' && s.startDate <= today()) || (s.kind === 'dars' && usedNow.c > 0))
        throw new Error("Abonement ishlatila boshlagan — «Tanlangan sanadan» bekor qiling.");
      refund = s.price;
    } else {
      const from = str(fd, 'from') || today();
      if (!isDate(from) || from < s.startDate || from > s.endDate) throw new Error('Sana abonement muddati ichida bo\'lsin.');
      if (s.kind === 'oy') {
        const total = monthsBetween(s.startDate.slice(0, 7), s.endDate.slice(0, 7)) + 1;
        const after_ = monthsBetween(from.slice(0, 7), s.endDate.slice(0, 7));
        refund = Math.round((s.price * after_) / total);
        newEnd = monthEnd(from.slice(0, 7));
      } else {
        // Darslik abonement faqat bugungacha bo'lgan sanadan to'xtatiladi; qolgan darslar qaytariladi va boshqa ishlatilmaydi
        if (from > today()) throw new Error("Darslik abonementni bugundan keyingi sanadan to'xtatib bo'lmaydi.");
        const [r] = await db.execute<{ c: number }>(sql`select count(*)::int c from charges where subscription_id = ${s.id} and kind = 'abonement_dars' and date < ${from}`);
        const left = Math.max(0, s.lessonsTotal - r.c);
        refund = s.lessonsTotal ? Math.round((s.price * left) / s.lessonsTotal) : 0;
        newEnd = addDays(from, -1);
        lessonsTotal = r.c;
      }
    }
    const done = await db.transaction(async (tx) => {
      const r = await tx
        .update(studentSubscriptions)
        .set({ status: mode === 'toliq' ? 'bekor' : 'toxtatildi', endDate: newEnd, lessonsTotal, refund, cancelledAt: new Date(), cancelledById: u.id, cancelReason: reason })
        .where(and(eq(studentSubscriptions.id, id), eq(studentSubscriptions.status, 'faol')))
        .returning({ id: studentSubscriptions.id });
      if (!r.length) return false;
      if (refund > 0)
        await tx.insert(charges).values({ studentId: s.studentId, enrollmentId: s.enrollmentId, groupId: null, kind: 'tuzatish', amount: -refund, date: today(), month: today().slice(0, 7), subscriptionId: s.id, note: `Abonement qaytarildi: ${s.name}`, createdById: u.id });
      return true;
    });
    if (!done) throw new Error('Abonement allaqachon bekor qilingan.');
    // Qoplash olib tashlangan davr oddiy tartibda qayta hisoblanadi
    const [e] = await db.select({ groupId: enrollments.groupId, billing: groups.billing }).from(enrollments).innerJoin(groups, eq(groups.id, enrollments.groupId)).where(eq(enrollments.id, s.enrollmentId));
    if (e?.billing === 'dars') {
      const dates = await db.execute<{ d: string }>(sql`select distinct date::text d from attendance where group_id = ${e.groupId} and student_id = ${s.studentId} and date between ${s.startDate.slice(0, 7) + '-01'} and ${today()}`);
      for (const r of dates) await syncLessonCharges(e.groupId, r.d, u.id);
    }
    await ensureMonthlyCharges(true);
    const [st] = await db.select({ name: students.fullName }).from(students).where(eq(students.id, s.studentId));
    const d = `${st?.name}: ${s.name}, qaytarildi ${money(refund)}. Sabab: ${reason}`;
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Abonement bekor qilindi', detail: d });
    await notifyTelegram(`↩️ SmartEdu: abonement bekor qilindi\n${d}\nKim: ${u.fullName}`);
    return { message: refund ? `Bekor qilindi, ${money(refund)} hisobga qaytarildi` : 'Bekor qilindi' };
  });
}

function monthsBetween(a: string, b: string) {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

