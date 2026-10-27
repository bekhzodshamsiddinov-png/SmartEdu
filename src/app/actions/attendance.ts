'use server';
import { and, eq, sql } from 'drizzle-orm';
import { syncLessonCharges } from '@/lib/billing';
import { db } from '@/db';
import { attendance, lessons, groups, notes, reasons } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run } from '@/lib/action';
import { assertBranch } from '@/lib/branch';
import { addDays, today } from '@/lib/dates';

type Mark = { studentId: number; status: 'keldi' | 'kelmadi' | 'kechikdi' | 'sababli'; reason?: string | null; reasonId?: number | null };

export async function saveAttendance(input: {
  groupId: number;
  date: string;
  marks: Mark[];
  topic?: string | null;
  teacherStatus?: string;
}) {
  return run(async () => {
    const u = await assertSection('attendance');
    await assertBranch('group', input.groupId);
    const [g] = await db.select().from(groups).where(eq(groups.id, input.groupId));
    if (!g) throw new Error('Guruh topilmadi.');
    if ((u.role === 'oqituvchi' || u.role === 'support') && g.teacherId !== u.id && g.supportId !== u.id)
      throw new Error("Faqat o'z guruhingiz davomatini belgilay olasiz.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Sana noto'g'ri.");
    // Kelajak kunlarga davomat yozib bo'lmaydi; o'qituvchi faqat oxirgi 3 kunni tuzata oladi
    const back = u.role === 'oqituvchi' || u.role === 'support' ? 3 : 60;
    if (input.date > today() || input.date < addDays(today(), -back)) throw new Error(`Davomatni faqat oxirgi ${back} kun uchun belgilash mumkin.`);
    if (!Array.isArray(input.marks) || !input.marks.length) throw new Error("Guruhda o'quvchi yo'q.");
    // Faqat shu guruhda haqiqatan o'qiyotgan o'quvchilar uchun davomat yoziladi
    const enrolled = new Set(
      (await db.execute<{ id: number }>(sql`select student_id id from enrollments where group_id = ${input.groupId} and start_date <= ${input.date} and (end_date is null or end_date >= ${input.date})`)).map((r) => r.id),
    );
    const STATUSES = ['keldi', 'kechikdi', 'kelmadi', 'sababli'];
    input.marks = input.marks.filter((m) => enrolled.has(Number(m.studentId)) && STATUSES.includes(String(m.status)));
    if (!input.marks.length) throw new Error("Guruhda o'quvchi yo'q.");
    if (input.topic && input.topic.length > 300) input.topic = input.topic.slice(0, 300);
    // Sabab faqat ma'lumotnomadagi davomat sabablaridan bo'lishi mumkin
    const validReasons = new Set(
      (await db.select({ id: reasons.id }).from(reasons).where(and(eq(reasons.kind, 'davomat'), eq(reasons.active, true)))).map((r) => r.id),
    );
    for (const m of input.marks) {
      const reasonId = m.status === 'sababli' && m.reasonId && validReasons.has(Number(m.reasonId)) ? Number(m.reasonId) : null;
      const reason = m.reason ? String(m.reason).slice(0, 200) : null;
      await db
        .insert(attendance)
        .values({ groupId: input.groupId, studentId: m.studentId, date: input.date, status: m.status, reason, reasonId, markedById: u.id })
        .onConflictDoUpdate({
          target: [attendance.groupId, attendance.studentId, attendance.date],
          set: { status: m.status, reason, reasonId, markedById: u.id },
        });
    }
    // "Dars bo'yicha" hisobdagi guruhda har bir dars uchun pul yechiladi
    await syncLessonCharges(input.groupId, input.date, u.id);
    const teacherStatus = u.role === 'oqituvchi' || u.role === 'support' ? undefined : input.teacherStatus;
    await db
      .insert(lessons)
      .values({ groupId: input.groupId, date: input.date, topic: input.topic || null, teacherStatus: teacherStatus || 'vaqtida', arrivalChecked: !!teacherStatus, markedById: u.id })
      .onConflictDoUpdate({
        target: [lessons.groupId, lessons.date],
        set: { topic: input.topic || null, ...(teacherStatus ? { teacherStatus, arrivalChecked: true } : {}), markedById: u.id },
      });
    // Ketma-ket 2 marta kelmaganlarni "xavf ostida" deb belgilash
    await db.execute(sql`
      update students set status = 'xavf'
      where status = 'faol' and id in (
        select student_id from (
          select student_id, status, row_number() over (partition by student_id order by date desc) rn from attendance
        ) t where rn <= 2 group by student_id having count(*) = 2 and count(*) filter (where status = 'kelmadi') = 2
      )`);
    // Kelgan bo'lsa yana faol
    const came = input.marks.filter((m) => m.status === 'keldi' || m.status === 'kechikdi').map((m) => m.studentId);
    if (came.length)
      await db.execute(sql`update students set status = 'faol' where status = 'xavf' and id in (${sql.join(came.map((c) => sql`${c}`), sql`, `)})`);
    return { message: 'Davomat saqlandi' };
  });
}

/** O'qituvchi/yordamchi faqat o'z guruhi bilan ishlaydi */
async function assertOwnGroup(u: { id: number; role: string }, groupId: number) {
  if (u.role !== 'oqituvchi' && u.role !== 'support') return;
  const [g] = await db.select({ t: groups.teacherId, s: groups.supportId }).from(groups).where(eq(groups.id, groupId));
  if (!g || (g.t !== u.id && g.s !== u.id)) throw new Error("Bu guruh sizniki emas.");
}

export async function markCalled(attendanceId: number, reason: string) {
  return run(async () => {
    const u = await assertSection('attendance');
    await assertBranch('attendance', attendanceId);
    const [a] = await db.select().from(attendance).where(eq(attendance.id, attendanceId));
    if (!a) throw new Error('Yozuv topilmadi.');
    await assertOwnGroup(u, a.groupId);
    await db.update(attendance).set({ called: true, reason: reason || a.reason }).where(eq(attendance.id, attendanceId));
    await db.insert(notes).values({
      entityType: 'student',
      entityId: a.studentId,
      kind: 'qongiroq',
      text: `${a.date} darsiga kelmagani bo'yicha qo'ng'iroq qilindi. Sabab: ${reason || 'aniqlanmadi'}`,
      authorId: u.id,
    });
    return { message: "Qo'ng'iroq qayd etildi" };
  });
}

export async function logParentReport(groupId: number, text: string) {
  return run(async () => {
    const u = await assertSection('attendance');
    await assertBranch('group', groupId);
    await assertOwnGroup(u, groupId);
    const list = await db.execute<{ student_id: number }>(sql`select student_id from enrollments where group_id = ${groupId} and active = true and end_date is null`);
    if (!list.length) throw new Error("Guruhda o'quvchi yo'q.");
    for (const r of list)
      await db.insert(notes).values({ entityType: 'student', entityId: r.student_id, kind: 'ota_ona', text: text || 'Haftalik proyekt ota-onaga yuborildi', authorId: u.id });
    return { message: `${list.length} ta ota-onaga yuborilgani qayd etildi` };
  });
}


export async function setArrival(groupId: number, date: string, status: 'vaqtida' | 'kechikdi' | 'otilmadi') {
  return run(async () => {
    const u = await assertSection('attendance');
    if (u.role !== 'admin' && u.role !== 'rahbar') throw new Error("O'qituvchi kelishini administrator belgilaydi.");
    await assertBranch('group', groupId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Sana noto'g'ri.");
    await db
      .insert(lessons)
      .values({ groupId, date, teacherStatus: status, arrivalChecked: true, markedById: u.id })
      .onConflictDoUpdate({ target: [lessons.groupId, lessons.date], set: { teacherStatus: status, arrivalChecked: true } });
    return { message: status === 'vaqtida' ? "O'qituvchi vaqtida keldi" : status === 'kechikdi' ? 'Kechikish qayd etildi' : "Dars o'tilmadi deb qayd etildi" };
  });
}
