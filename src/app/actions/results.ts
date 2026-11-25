'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { results, resultFiles, students } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int, bool } from '@/lib/action';
import { today } from '@/lib/dates';
import { assertBranch } from '@/lib/branch';
import { assertOwnStudent } from '@/lib/access';
import { RESULT_LEVELS, RESULT_META, RESULT_PLACES, RESULT_TYPES } from '@/lib/constants';
import { clean } from '@/lib/leads-ingest';

const WRITERS = ['rahbar', 'admin', 'oqituvchi', 'support'];

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
    if (!WRITERS.includes(u.role)) throw new Error("Yutuqni o'qituvchi yoki administrator yozadi.");
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
    const files = await readFiles(fd);
    const [row] = await db.insert(results).values({
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
    }).returning({ id: results.id });
    if (files.length) await db.insert(resultFiles).values(files.map((f) => ({ ...f, resultId: row.id, createdById: u.id })));
    return { message: files.length ? `Yutuq va ${files.length} ta fayl saqlandi` : "Yutuq qo'shildi", id: row.id };
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

/* ---------- Sertifikat va loyiha fayllari ---------- */

const MAX_FILE = 3 * 1024 * 1024;
const MAX_FILES = 6;

/** Fayl turini kengaytmasidan emas, ichidagi baytlardan aniqlaymiz (SVG/HTML kabi xavfli fayllar o'tmaydi) */
function sniff(b: Buffer): string | null {
  if (b.length > 4 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

async function readFiles(fd: FormData) {
  const list = fd.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && (f as File).size > 0);
  if (list.length > MAX_FILES) throw new Error(`Bir martada ${MAX_FILES} tadan ko'p fayl bo'lmaydi.`);
  const out: { name: string; mime: string; size: number; data: Buffer }[] = [];
  for (const f of list) {
    if (f.size > MAX_FILE) throw new Error(`«${f.name.slice(0, 40)}» 3 MB dan katta. Rasmni kichikroq qilib yoki PDF ni siqib yuklang.`);
    const data = Buffer.from(await f.arrayBuffer());
    const mime = sniff(data);
    if (!mime) throw new Error(`«${f.name.slice(0, 40)}»: faqat PDF, JPG, PNG yoki WEBP yuklanadi.`);
    const base = (clean(f.name.split(/[\\/]/).pop(), 100) ?? 'fayl').replace(/[<>:"|?*]/g, '_');
    out.push({ name: base, mime, size: data.length, data });
  }
  return out;
}

/** Bor yutuqqa sertifikat yoki loyiha rasmini qo'shish */
export async function addResultFiles(resultId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!WRITERS.includes(u.role)) throw new Error("Faylni o'qituvchi yoki administrator yuklaydi.");
    const [r] = await db.execute<{ student_id: number; status: string; n: number }>(sql`
      select r.student_id, s.status::text, (select count(*)::int from result_files f where f.result_id = r.id) n
      from results r join students s on s.id = r.student_id where r.id = ${resultId}`);
    if (!r) throw new Error('Yutuq topilmadi.');
    await assertBranch('student', r.student_id);
    if (r.status !== 'bitirgan') await assertOwnStudent(u, r.student_id);
    else if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Bitiruvchi fayllarini administrator yuklaydi.");
    const files = await readFiles(fd);
    if (!files.length) throw new Error('Faylni tanlang.');
    if (r.n + files.length > MAX_FILES) throw new Error(`Bitta yutuqqa ${MAX_FILES} tagacha fayl biriktiriladi.`);
    await db.insert(resultFiles).values(files.map((f) => ({ ...f, resultId, createdById: u.id })));
    return { message: `${files.length} ta fayl yuklandi` };
  });
}

export async function deleteResultFile(fileId: number) {
  return run(async () => {
    const [f] = await db.execute<{ result_id: number }>(sql`select result_id from result_files where id = ${fileId}`);
    if (!f) throw new Error('Fayl topilmadi.');
    await own(f.result_id);
    await db.delete(resultFiles).where(eq(resultFiles.id, fileId));
    return { message: "Fayl o'chirildi" };
  });
}

/** Yutuq havolasini keyin qo'shish yoki o'zgartirish */
export async function setResultLink(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (!WRITERS.includes(u.role)) throw new Error("Buni o'qituvchi yoki administrator bajaradi.");
    const [r] = await db.execute<{ student_id: number; status: string }>(sql`select r.student_id, s.status::text from results r join students s on s.id = r.student_id where r.id = ${id}`);
    if (!r) throw new Error('Yutuq topilmadi.');
    await assertBranch('student', r.student_id);
    if (r.status !== 'bitirgan') await assertOwnStudent(u, r.student_id);
    else if (u.role === 'oqituvchi' || u.role === 'support') throw new Error("Bitiruvchi yutug'ini administrator o'zgartiradi.");
    await db.update(results).set({ link: safeLink(str(fd, 'link')) }).where(eq(results.id, id));
    return { message: 'Havola saqlandi' };
  });
}
