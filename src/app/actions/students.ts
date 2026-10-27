'use server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students, enrollments, groups, courses, notes, grades, results, graduates, leads } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { today } from '@/lib/dates';
import { assertBranch, resolveBranch } from '@/lib/branch';
import { audit } from '@/lib/security';
import { ensureMonthlyCharges, syncCurrentMonthFee } from '@/lib/billing';
import { assertNoActiveSubscription } from '@/lib/subscription-guard';

async function feeFor(groupId: number) {
  const [g] = await db
    .select({ price: courses.monthlyPrice })
    .from(groups)
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .where(eq(groups.id, groupId));
  return g?.price ?? 0;
}

export async function createStudent(fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("O'quvchini administrator qo'shadi.");
    const p = str(fd, 'phone');
    const pp = str(fd, 'parentPhone');
    const joinedAt = str(fd, 'joinedAt') || today();
    const gid = int(fd, 'groupId');
    await assertBranch('group', gid);
    const [grp] = gid ? await db.select({ b: groups.branchId }).from(groups).where(eq(groups.id, gid)) : [];
    const branchId = grp?.b ?? (await resolveBranch(null));
    await assertBranch('lead', int(fd, 'leadId'));
    const [s] = await db
      .insert(students)
      .values({
        fullName: req(fd, 'fullName', 'Ism-familiya'),
        phone: p ? normalizePhone(p) : null,
        parentName: str(fd, 'parentName'),
        parentPhone: pp ? normalizePhone(pp) : null,
        ...birth(fd),
        school: str(fd, 'school'),
        address: str(fd, 'address'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
        joinedAt,
        branchId,
        leadId: int(fd, 'leadId'),
      })
      .returning({ id: students.id });
    const groupId = int(fd, 'groupId');
    if (groupId) {
      // Narxni faqat rahbar/administrator o'zgartiradi, qolganlarga guruh narxi qo'llanadi
      const custom = canSetFee(u.role) ? int(fd, 'monthlyFee') : null;
      if (custom !== null && custom < 0) throw new Error("Oylik to'lov manfiy bo'lmaydi.");
      const fee = custom ?? (await feeFor(groupId));
      await db.insert(enrollments).values({ studentId: s.id, groupId, monthlyFee: fee, startDate: str(fd, 'startDate') || joinedAt });
      await ensureMonthlyCharges(true);
    }
    const leadId = int(fd, 'leadId');
    if (leadId) await db.update(leads).set({ studentId: s.id, stage: 'tolov_qildi', maxStage: 4, updatedAt: new Date() }).where(eq(leads.id, leadId));
    return { id: s.id, message: "O'quvchi qo'shildi" };
  });
}

export async function updateStudent(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support' || u.role === 'bugalter') throw new Error("Ma'lumotni administrator o'zgartiradi.");
    await assertBranch('student', id);
    const p = str(fd, 'phone');
    const pp = str(fd, 'parentPhone');
    await db
      .update(students)
      .set({
        fullName: req(fd, 'fullName', 'Ism-familiya'),
        phone: p ? normalizePhone(p) : null,
        parentName: str(fd, 'parentName'),
        parentPhone: pp ? normalizePhone(pp) : null,
        ...birth(fd),
        school: str(fd, 'school'),
        address: str(fd, 'address'),
        source: str(fd, 'source'),
        note: str(fd, 'note'),
        joinedAt: str(fd, 'joinedAt') || undefined,
      })
      .where(eq(students.id, id));
    return { message: "Ma'lumotlar yangilandi" };
  });
}

/** O'qituvchi/yordamchi faqat o'z guruhidagi o'quvchiga tegishi mumkin */
async function assertOwnStudent(u: { id: number; role: string }, studentId: number) {
  if (u.role !== 'oqituvchi' && u.role !== 'support') return;
  const [r] = await db.execute<{ c: number }>(sql`
    select count(*)::int c from enrollments e join groups g on g.id = e.group_id
    where e.student_id = ${studentId} and e.active and e.end_date is null and (g.teacher_id = ${u.id} or g.support_id = ${u.id})`);
  if (!r?.c) throw new Error("Bu o'quvchi sizning guruhingizda emas.");
}

const canSetFee = (role: string) => role === 'rahbar' || role === 'admin';

/** Tug'ilgan sana (yil ham shundan olinadi); eski "yil" maydoni bo'lsa — uni saqlaymiz */
function birth(fd: FormData) {
  const d = str(fd, 'birthDate');
  if (d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '1950-01-01' || d > today()) throw new Error("Tug'ilgan sana noto'g'ri.");
    return { birthDate: d, birthYear: Number(d.slice(0, 4)) };
  }
  if (fd.has('birthYear')) return { birthYear: int(fd, 'birthYear') };
  return fd.has('birthDate') ? { birthDate: null } : {};
}

/** Holatni o'zgartirish: ketdi / bitirdi / muzlatildi / qayta faollashtirildi */
export async function changeStatus(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'bugalter') throw new Error("Holatni administrator o'zgartiradi.");
    await assertBranch('student', id);
    await assertBranch('group', int(fd, 'groupId'));
    const status = req(fd, 'status', 'Holat') as 'faol' | 'xavf' | 'muzlatilgan' | 'ketgan' | 'bitirgan';
    if (!['faol', 'xavf', 'muzlatilgan', 'ketgan', 'bitirgan'].includes(status)) throw new Error("Holat noto'g'ri.");
    if (u.role === 'oqituvchi' || u.role === 'support') {
      // O'qituvchi faqat o'z o'quvchisini "xavf ostida" deb belgilay oladi
      if (status !== 'xavf') throw new Error("Holatni administrator o'zgartiradi.");
      await assertOwnStudent(u, id);
    }
    // To'lov hisobini to'xtatadigan holatlar (ketdi, muzlatildi, bitirdi) — faqat rahbar yoki administrator
    if ((status === 'ketgan' || status === 'muzlatilgan' || status === 'bitirgan') && !canSetFee(u.role)) {
      throw new Error("Bu holatni rahbar yoki administrator o'zgartiradi.");
    }
    const date = str(fd, 'date') || today();
    if (status === 'ketgan' || status === 'bitirgan' || status === 'muzlatilgan') await assertNoActiveSubscription({ studentId: id });
    if (status === 'ketgan') {
      const reason = req(fd, 'leftReason', 'Ketish sababi');
      await db
        .update(students)
        .set({ status, leftAt: date, leftReason: reason, returnAttempt: str(fd, 'returnAttempt'), returnResult: str(fd, 'returnResult') })
        .where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      if (str(fd, 'returnAttempt'))
        await db.insert(notes).values({ entityType: 'student', entityId: id, kind: 'qongiroq', text: `Qaytarish urinishi: ${str(fd, 'returnAttempt')}. Natija: ${str(fd, 'returnResult') || '—'}`, authorId: u.id });
      return { message: "O'quvchi ketgan deb belgilandi" };
    }
    if (status === 'bitirgan') {
      await db.update(students).set({ status, graduatedAt: date }).where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      await db.insert(graduates).values({ studentId: id, lastContactAt: date }).onConflictDoNothing();
      return { message: "Bitiruvchilar ro'yxatiga qo'shildi" };
    }
    if (status === 'muzlatilgan') {
      const until = str(fd, 'freezeUntil');
      if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until) || until < date) throw new Error('Qaytish sanasini kiriting.');
      await db.update(students).set({ status, freezeUntil: until, leftReason: req(fd, 'freezeReason', 'Muzlatish sababi').slice(0, 80) }).where(eq(students.id, id));
      await db.update(enrollments).set({ active: false, endDate: date }).where(and(eq(enrollments.studentId, id), isNull(enrollments.endDate)));
      return { message: "O'qish vaqtincha to'xtatildi" };
    }
    await db.update(students).set({ status, leftAt: null, leftReason: null, freezeUntil: null }).where(eq(students.id, id));
    // O'qituvchi guruhga qo'sha olmaydi (to'lov hisoblanishi boshlanadi)
    const groupId = u.role === 'oqituvchi' || u.role === 'support' ? null : int(fd, 'groupId');
    if (groupId) {
      const custom = canSetFee(u.role) ? int(fd, 'monthlyFee') : null;
      if (custom !== null && custom < 0) throw new Error("Oylik to'lov manfiy bo'lmaydi.");
      const fee = custom ?? (await feeFor(groupId));
      await db.insert(enrollments).values({ studentId: id, groupId, monthlyFee: fee, startDate: date });
      await ensureMonthlyCharges(true);
    }
    return { message: status === 'xavf' ? 'Xavf ostida deb belgilandi' : "O'quvchi faol" };
  });
}

/** Return attempt result update for a student who left */
export async function updateReturn(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Buni administrator yoki sotuv bo'limi yozadi.");
    await assertBranch('student', id);
    const attempt = req(fd, 'returnAttempt', 'Nima qilindi');
    const result = req(fd, 'returnResult', 'Natija');
    await db.update(students).set({ returnAttempt: attempt, returnResult: result }).where(eq(students.id, id));
    await db.insert(notes).values({ entityType: 'student', entityId: id, kind: 'qongiroq', text: `Qaytarish urinishi: ${attempt}. Natija: ${result}`, authorId: u.id });
    return { message: 'Saqlandi' };
  });
}

export async function enroll(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Guruhga administrator qo'shadi.");
    const groupId = int(fd, 'groupId');
    if (!groupId) throw new Error('Guruhni tanlang.');
    await assertBranch('student', studentId);
    await assertBranch('group', groupId);
    const custom = canSetFee(u.role) ? int(fd, 'monthlyFee') : null;
    if (custom !== null && custom < 0) throw new Error("Oylik to'lov manfiy bo'lmaydi.");
    const fee = custom ?? (await feeFor(groupId));
    await db.insert(enrollments).values({ studentId, groupId, monthlyFee: fee, startDate: str(fd, 'startDate') || today() });
      await ensureMonthlyCharges(true);
    const [g] = await db.select({ b: groups.branchId }).from(groups).where(eq(groups.id, groupId));
    if (g?.b) await db.update(students).set({ branchId: g.b }).where(eq(students.id, studentId));
    await db.update(students).set({ status: 'faol' }).where(and(eq(students.id, studentId), eq(students.status, 'muzlatilgan')));
    return { message: "Guruhga qo'shildi" };
  });
}

export async function endEnrollment(enrollmentId: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (!canSetFee(u.role)) throw new Error("Guruhdan chiqarishni rahbar yoki administrator bajaradi.");
    await assertBranch('enrollment', enrollmentId);
    await assertNoActiveSubscription({ enrollmentId });
    await db.update(enrollments).set({ active: false, endDate: today() }).where(eq(enrollments.id, enrollmentId));
    return { message: 'Guruhdan chiqarildi' };
  });
}

export async function updateFee(enrollmentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin'].includes(u.role)) throw new Error("Narxni rahbar yoki administrator o'zgartiradi.");
    await assertBranch('enrollment', enrollmentId);
    const fee = int(fd, 'monthlyFee');
    if (fee === null || fee < 0) throw new Error("Oylik to'lovni kiriting.");
    const [old] = await db.select({ f: enrollments.monthlyFee }).from(enrollments).where(eq(enrollments.id, enrollmentId));
    if (!old) throw new Error('Yozuv topilmadi.');
    await db.update(enrollments).set({ monthlyFee: fee }).where(eq(enrollments.id, enrollmentId));
    await syncCurrentMonthFee(enrollmentId, fee, old.f);
    return { message: "Oylik to'lov yangilandi" };
  });
}

export async function addNote(entityType: 'student' | 'lead', entityId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection(entityType === 'lead' ? 'leads' : 'students');
    await assertBranch(entityType === 'lead' ? 'lead' : 'student', entityId);
    if (entityType === 'student') await assertOwnStudent(u, entityId);
    await db.insert(notes).values({ entityType, entityId, kind: str(fd, 'kind') || 'izoh', text: req(fd, 'text', 'Matn'), authorId: u.id });
    return { message: 'Yozib qo\'yildi' };
  });
}

export async function addGrade(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin', 'oqituvchi', 'support'].includes(u.role)) throw new Error("Bahoni o'qituvchi qo'yadi.");
    await assertBranch('student', studentId);
    await assertOwnStudent(u, studentId);
    const gid = int(fd, 'groupId');
    if (gid) {
      const [e] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.studentId, studentId), eq(enrollments.groupId, gid)));
      if (!e) throw new Error("Guruh noto'g'ri.");
    }
    const score = int(fd, 'score');
    if (score === null || score < 0 || score > 100) throw new Error("Baho 0 dan 100 gacha bo'lsin.");
    await db.insert(grades).values({ studentId, groupId: int(fd, 'groupId'), period: req(fd, 'period', 'Davr'), score, comment: str(fd, 'comment'), teacherId: u.id });
    return { message: 'Baho qo\'yildi' };
  });
}

export async function addResult(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin', 'oqituvchi', 'support'].includes(u.role)) throw new Error("Natijani o'qituvchi yoki administrator yozadi.");
    await assertBranch('student', studentId);
    await assertOwnStudent(u, studentId);
    await db.insert(results).values({
      studentId,
      type: req(fd, 'type', 'Turi'),
      title: req(fd, 'title', 'Natija'),
      amount: int(fd, 'amount'),
      date: str(fd, 'date') || today(),
      note: str(fd, 'note'),
    });
    return { message: 'Natija qo\'shildi' };
  });
}

export async function deleteStudent(id: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role !== 'rahbar') throw new Error("O'quvchini faqat rahbar o'chira oladi.");
    const [st] = await db.select({ name: students.fullName }).from(students).where(eq(students.id, id));
    if (!st) throw new Error("O'quvchi topilmadi.");
    const [pays] = await db.execute<{ c: number; s: number }>(sql`select count(*)::int c, coalesce(sum(amount),0)::bigint s from payments where student_id = ${id}`);
    // To'lovi bor o'quvchini o'chirsa moliya tarixi ham yo'qoladi — buning o'rniga "ketdi" holatini qo'ying
    if (pays.c > 0) throw new Error(`Bu o'quvchida ${pays.c} ta to'lov bor. Moliya tarixi yo'qolmasligi uchun o'chirmang — "Ketdi" holatini qo'ying.`);
    await db.delete(students).where(eq(students.id, id));
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "O'quvchi o'chirildi", detail: st.name });
    return { message: "O'quvchi o'chirildi" };
  });
}
