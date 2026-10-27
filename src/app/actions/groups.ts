'use server';
import { ensureMonthlyCharges, lessonsInMonth, syncLessonCharges } from '@/lib/billing';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { charges } from '@/db/schema';
import { groups, courses, enrollments, students } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { DAY_CODES, addDays, groupHasLessonOn } from '@/lib/dates';
import { scheduleConflict } from '@/lib/schedule';
import { moveSubscriptions } from '@/lib/subscription-guard';
import { assertBranch, assertStaffFor, resolveBranch } from '@/lib/branch';

function onlyManagers(role: string) {
  if (!['rahbar', 'admin'].includes(role)) throw new Error("Guruhlarni rahbar yoki administrator boshqaradi.");
}

function daysFrom(fd: FormData) {
  const d = fd.getAll('days').map(String).filter((x) => DAY_CODES.includes(x));
  if (!d.length) throw new Error('Dars kunlarini tanlang.');
  return DAY_CODES.filter((x) => d.includes(x)).join(',');
}

export async function saveGroup(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    const courseId = int(fd, 'courseId');
    if (!courseId) throw new Error("Yo'nalishni tanlang.");
    const v = {
      name: req(fd, 'name', 'Guruh nomi'),
      courseId,
      teacherId: int(fd, 'teacherId'),
      supportId: int(fd, 'supportId'),
      days: daysFrom(fd),
      startTime: req(fd, 'startTime', 'Boshlanish vaqti'),
      endTime: req(fd, 'endTime', 'Tugash vaqti'),
      room: str(fd, 'room'),
      capacity: int(fd, 'capacity') ?? 14,
      // Hisob turi: 'oylik' yoki 'dars'
      ...(fd.has('billing') ? { billing: str(fd, 'billing') === 'dars' ? 'dars' : 'oylik' } : {}),
      startDate: str(fd, 'startDate'),
      branchId: fd.has('branchId') || !id ? await resolveBranch(int(fd, 'branchId')) : undefined,
    };
    const branchOf = v.branchId ?? (id ? (await db.select({ b: groups.branchId }).from(groups).where(eq(groups.id, id)))[0]?.b : null);
    await assertStaffFor(v.teacherId, ['oqituvchi', 'rahbar', 'admin'], branchOf);
    await assertStaffFor(v.supportId, ['support', 'oqituvchi', 'admin', 'rahbar'], branchOf);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.endTime)) throw new Error("Vaqtni SS:DD ko'rinishida kiriting.");
    const clash = await scheduleConflict({ id, days: v.days, startTime: v.startTime, endTime: v.endTime, room: v.room, teacherId: v.teacherId, branchId: branchOf });
    if (clash) throw new Error(clash);
    const prevBilling = id ? (await db.select({ b: groups.billing }).from(groups).where(eq(groups.id, id)))[0]?.b : null;
    if (id) await db.update(groups).set(v).where(eq(groups.id, id));
    else await db.insert(groups).values(v);
    if (id && v.billing && prevBilling && v.billing !== prevBilling) await switchBilling(id, v.billing);
    return { message: id ? 'Guruh yangilandi' : 'Guruh ochildi' };
  });
}

export async function closeGroup(id: number) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    await db.update(groups).set({ active: false }).where(eq(groups.id, id));
    return { message: 'Guruh yopildi' };
  });
}

export async function reopenGroup(id: number) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    await assertBranch('group', id);
    await db.update(groups).set({ active: true }).where(eq(groups.id, id));
    return { message: 'Guruh qayta ochildi' };
  });
}

export async function saveCourse(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    if (u.role !== 'rahbar') throw new Error("Yo'nalish va narxlarni rahbar belgilaydi.");
    const v = {
      name: req(fd, 'name', "Yo'nalish nomi"),
      monthlyPrice: int(fd, 'monthlyPrice') ?? 0,
      durationMonths: int(fd, 'durationMonths') ?? 3,
      color: str(fd, 'color') || '#008A70',
      description: str(fd, 'description'),
      active: id ? bool(fd, 'active') : true,
    };
    if (id) await db.update(courses).set(v).where(eq(courses.id, id));
    else await db.insert(courses).values(v);
    return { message: id ? "Yo'nalish yangilandi" : "Yo'nalish qo'shildi" };
  });
}

export async function moveStudent(enrollmentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('groups');
    onlyManagers(u.role);
    const groupId = int(fd, 'groupId');
    if (!groupId) throw new Error('Yangi guruhni tanlang.');
    await assertBranch('enrollment', enrollmentId);
    await assertBranch('group', groupId);
    const [e] = await db.select().from(enrollments).where(and(eq(enrollments.id, enrollmentId), isNull(enrollments.endDate)));
    if (!e) throw new Error('Yozuv topilmadi.');
    // Amaldagi abonement yangi guruhga o'tadi (mos kelmasa — ko'chirish to'xtatiladi)
    const subIds = await moveSubscriptions(enrollmentId, groupId);
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    await db.update(enrollments).set({ active: false, endDate: d }).where(eq(enrollments.id, enrollmentId));
    const [ne] = await db.insert(enrollments).values({ studentId: e.studentId, groupId, monthlyFee: e.monthlyFee, startDate: d }).returning({ id: enrollments.id });
    // Shu oy avvalgi guruhda allaqachon hisoblangan bo'lsa, yangi guruhda ikkinchi marta yechilmaydi
    if (subIds.length) await db.execute(sql`update student_subscriptions set enrollment_id = ${ne.id} where id in (${sql.join(subIds.map((x) => sql`${x}`), sql`, `)})`);
    const [already] = await db.execute<{ c: number }>(sql`select count(*)::int c from charges where enrollment_id = ${enrollmentId} and kind = 'oylik' and month = ${d.slice(0, 7)}`);
    if (already.c) {
      const [ng] = await db.select({ billing: groups.billing }).from(groups).where(eq(groups.id, groupId));
      if (ng?.billing === 'dars') {
        // Yangi guruhda har dars uchun yechiladi — eski guruhdagi oylik to'lovning qolgan darslarga to'g'ri keladigan qismi qaytariladi
        const [og] = await db.select({ days: groups.days }).from(groups).where(eq(groups.id, e.groupId));
        const month = d.slice(0, 7);
        const total = lessonsInMonth(og.days, month);
        let left = 0;
        for (let x = d; x.slice(0, 7) === month; x = addDays(x, 1)) if (groupHasLessonOn(og.days, x)) left++;
        const refund = total ? Math.round((e.monthlyFee * left) / total) : 0;
        if (refund > 0)
          await db.insert(charges).values({ studentId: e.studentId, enrollmentId: e.id, groupId: e.groupId, kind: 'tuzatish', amount: -refund, date: d, month, note: `Ko'chirildi: qolgan ${left} dars uchun qaytarildi`, createdById: u.id });
      } else {
        await db
          .insert(charges)
          .values({ studentId: e.studentId, enrollmentId: ne.id, groupId, kind: 'oylik', amount: 0, date: d, month: d.slice(0, 7), note: "Ko'chirildi: bu oy avvalgi guruhda hisoblangan", createdById: u.id })
          .onConflictDoNothing();
      }
    }
    await ensureMonthlyCharges(true);
    const [g] = await db.select({ b: groups.branchId }).from(groups).where(eq(groups.id, groupId));
    if (g?.b) await db.update(students).set({ branchId: g.b }).where(eq(students.id, e.studentId));
    return { message: "Boshqa guruhga o'tkazildi" };
  });
}

/**
 * Hisob turi o'zgarganda joriy oy yangi qoida bo'yicha qayta hisoblanadi (o'tgan oylar o'zgarmaydi).
 * oylik → dars: shu oydagi oylik yechim olib tashlanadi, shu oyda o'tilgan darslar bo'yicha yechiladi.
 * dars → oylik: shu oydagi dars yechimlari olib tashlanadi, oylik to'lov hisoblanadi.
 */
async function switchBilling(groupId: number, billing: string) {
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()).slice(0, 7);
  if (billing === 'dars') {
    await db.execute(sql`delete from charges where group_id = ${groupId} and kind = 'oylik' and month = ${month}`);
    const dates = await db.execute<{ d: string }>(sql`select distinct date::text d from attendance where group_id = ${groupId} and to_char(date, 'YYYY-MM') = ${month}`);
    for (const r of dates) await syncLessonCharges(groupId, r.d);
  } else {
    await db.execute(sql`delete from charges where group_id = ${groupId} and kind = 'dars' and month = ${month}`);
    await ensureMonthlyCharges(true);
  }
}
