'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { results, students } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { today } from '@/lib/dates';
import { assertBranch } from '@/lib/branch';
import { assertOwnStudent } from '@/lib/access';
import { RESULT_LEVELS, RESULT_META, RESULT_PLACES, RESULT_TYPES } from '@/lib/constants';
import { clean } from '@/lib/leads-ingest';

const WRITERS = ['rahbar', 'admin', 'oqituvchi', 'support', 'marketing'];

/** Isbot havolasi faqat https bo'lishi kerak (javascript:, data: va h.k. rad etiladi) */
function safeLink(v: string | null) {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:') throw new Error();
    return u.toString().slice(0, 400);
  } catch {
    throw new Error("Havola https:// bilan boshlanishi kerak (Play Market, YouTube, sertifikat sahifasi).");
  }
}

/** O'quvchi yoki bitiruvchining yutug'i: musobaqa, Play Market ilova, sotilgan loyiha, YouTube daromadi... */
export async function addResult(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!WRITERS.includes(u.role)) throw new Error("Yutuqni o'qituvchi, administrator yoki marketolog yozadi.");
    await assertBranch('student', studentId);
    const [st] = await db.select({ status: students.status }).from(students).where(eq(students.id, studentId));
    if (!st) throw new Error("O'quvchi topilmadi.");
    if (st.status !== 'bitirgan') await assertOwnStudent(u, studentId);
    else if (u.role === 'oqituvchi' || u.role === 'support') throw new Error('Bitiruvchi yutug\'ini administrator yozadi.');
    const type = req(fd, 'type', 'Turi');
    if (!RESULT_TYPES.includes(type)) throw new Error("Yutuq turini tanlang.");
    const meta = RESULT_META[type] ?? {};
    const place = meta.place ? str(fd, 'place') : null;
    if (place && !RESULT_PLACES.some((p) => p.k === place)) throw new Error("O'rin noto'g'ri.");
    const level = str(fd, 'level');
    if (level && !RESULT_LEVELS.some((p) => p.k === level)) throw new Error("Daraja noto'g'ri.");
    const amount = meta.money ? int(fd, 'amount') : null;
    if (amount !== null && (amount < 0 || amount > 10_000_000_000)) throw new Error("Summa noto'g'ri.");
    const date = str(fd, 'date') || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) throw new Error("Sana noto'g'ri (kelajak sana bo'lmaydi).");
    await db.insert(results).values({
      studentId,
      type,
      title: clean(req(fd, 'title', 'Yutuq'), 160)!,
      amount,
      date,
      note: clean(str(fd, 'note'), 400),
      place,
      level,
      link: safeLink(str(fd, 'link')),
      isPublic: bool(fd, 'isPublic'),
      createdById: u.id,
    });
    return { message: "Yutuq qo'shildi" };
  });
}

async function own(id: number) {
  const u = await assertSection('students');
  const [r] = await db.execute<{ student_id: number; created_by_id: number | null }>(sql`select student_id, created_by_id from results where id = ${id}`);
  if (!r) throw new Error('Yutuq topilmadi.');
  await assertBranch('student', r.student_id);
  // O'chirish/ommaga chiqarish: rahbar, administrator yoki yozgan xodimning o'zi
  if (!['rahbar', 'admin'].includes(u.role) && r.created_by_id !== u.id) throw new Error("Buni rahbar, administrator yoki yozgan xodim o'zgartiradi.");
  return u;
}

export async function deleteResult(id: number) {
  return run(async () => {
    await own(id);
    await db.delete(results).where(eq(results.id, id));
    return { message: "Yutuq o'chirildi" };
  });
}

/** Saytdagi "Yutuqlarimiz" sahifasida ko'rsatish (o'quvchi va ota-ona roziligi olingandan keyin) */
export async function toggleResultPublic(id: number) {
  return run(async () => {
    await own(id);
    const [r] = await db.execute<{ is_public: boolean }>(sql`update results set is_public = not is_public where id = ${id} returning is_public`);
    return { message: r?.is_public ? 'Saytda ko\'rsatiladi' : 'Saytdan olindi' };
  });
}

/** Yutuq qo'shish oynasi uchun o'quvchi/bitiruvchi qidiruvi (o'qituvchi faqat o'z guruhidagilarni ko'radi) */
export async function searchStudentsForResult(q: string) {
  const u = await assertSection('students');
  const t = String(q ?? '').trim().slice(0, 40);
  if (t.length < 2) return [];
  const { getBranchScope } = await import('@/lib/branch');
  const scope = await getBranchScope();
  const mine = u.role === 'oqituvchi' || u.role === 'support';
  const rows = await db.execute<{ id: number; name: string; status: string }>(sql`
    select s.id, s.full_name name, s.status::text from students s
    where s.full_name ilike ${'%' + t.replace(/[%_\\]/g, '') + '%'}
      ${scope.id ? sql`and s.branch_id = ${scope.id}` : sql``}
      ${mine ? sql`and exists (select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id and e.active and e.end_date is null and (g.teacher_id = ${u.id} or g.support_id = ${u.id}))` : sql``}
    order by s.full_name limit 8`);
  return [...rows];
}
