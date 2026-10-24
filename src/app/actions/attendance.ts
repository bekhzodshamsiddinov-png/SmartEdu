'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attendance, lessons, groups, notes } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run } from '@/lib/action';

type Mark = { studentId: number; status: 'keldi' | 'kelmadi' | 'kechikdi' | 'sababli'; reason?: string | null };

export async function saveAttendance(input: {
  groupId: number;
  date: string;
  marks: Mark[];
  topic?: string | null;
  teacherStatus?: string;
}) {
  return run(async () => {
    const u = await assertSection('attendance');
    const [g] = await db.select().from(groups).where(eq(groups.id, input.groupId));
    if (!g) throw new Error('Guruh topilmadi.');
    if ((u.role === 'oqituvchi' || u.role === 'support') && g.teacherId !== u.id && g.supportId !== u.id)
      throw new Error("Faqat o'z guruhingiz davomatini belgilay olasiz.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Sana noto'g'ri.");
    if (!input.marks.length) throw new Error("Guruhda o'quvchi yo'q.");
    for (const m of input.marks) {
      await db
        .insert(attendance)
        .values({ groupId: input.groupId, studentId: m.studentId, date: input.date, status: m.status, reason: m.reason || null, markedById: u.id })
        .onConflictDoUpdate({
          target: [attendance.groupId, attendance.studentId, attendance.date],
          set: { status: m.status, reason: m.reason || null, markedById: u.id },
        });
    }
    const teacherStatus = u.role === 'oqituvchi' || u.role === 'support' ? undefined : input.teacherStatus;
    await db
      .insert(lessons)
      .values({ groupId: input.groupId, date: input.date, topic: input.topic || null, teacherStatus: teacherStatus || 'vaqtida', markedById: u.id })
      .onConflictDoUpdate({
        target: [lessons.groupId, lessons.date],
        set: { topic: input.topic || null, ...(teacherStatus ? { teacherStatus } : {}), markedById: u.id },
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

export async function markCalled(attendanceId: number, reason: string) {
  return run(async () => {
    const u = await assertSection('attendance');
    const [a] = await db.select().from(attendance).where(eq(attendance.id, attendanceId));
    if (!a) throw new Error('Yozuv topilmadi.');
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
    const list = await db.execute<{ student_id: number }>(sql`select student_id from enrollments where group_id = ${groupId} and active = true and end_date is null`);
    if (!list.length) throw new Error("Guruhda o'quvchi yo'q.");
    for (const r of list)
      await db.insert(notes).values({ entityType: 'student', entityId: r.student_id, kind: 'ota_ona', text: text || 'Haftalik proyekt ota-onaga yuborildi', authorId: u.id });
    return { message: `${list.length} ta ota-onaga yuborilgani qayd etildi` };
  });
}

