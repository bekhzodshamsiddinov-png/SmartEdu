'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { graduates, graduateContacts, students } from '@/db/schema';
import { assertBranch } from '@/lib/branch';
import { assertSection } from '@/lib/auth';
import { run, str, int, bool } from '@/lib/action';
import { addDays, today } from '@/lib/dates';
import { ALUMNI_CHANNELS } from '@/lib/constants';
import { clean } from '@/lib/leads-ingest';
import { getSettings } from '@/lib/settings';

/** Daromad — shaxsiy ma'lumot: faqat rahbar va administrator ko'radi va o'zgartiradi */
const seesIncome = (role: string) => role === 'rahbar' || role === 'admin';

async function guard(studentId: number) {
  const u = await assertSection('graduates');
  await assertBranch('student', studentId);
  const [st] = await db.select({ status: students.status }).from(students).where(eq(students.id, studentId));
  if (!st || st.status !== 'bitirgan') throw new Error("Bu o'quvchi bitiruvchi emas.");
  if (u.role === 'oqituvchi') {
    const [own] = await db.execute(sql`select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = ${studentId} and g.teacher_id = ${u.id} limit 1`);
    if (!own) throw new Error('Bu bitiruvchi sizning guruhingizda o\'qimagan.');
  }
  return u;
}

const dateOrNull = (v: string | null) => {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Sana noto'g'ri.");
  return v;
};

export async function saveGraduate(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await guard(studentId);
    const v = {
      workplace: clean(str(fd, 'workplace'), 120),
      position: clean(str(fd, 'position'), 120),
      freelance: bool(fd, 'freelance'),
      studyingAt: clean(str(fd, 'studyingAt'), 160),
      field: clean(str(fd, 'field'), 80),
      socials: clean(str(fd, 'socials'), 160),
      nextContactAt: dateOrNull(str(fd, 'nextContactAt')),
      referrals: Math.max(0, Math.min(1000, int(fd, 'referrals') ?? 0)),
      inTelegramGroup: bool(fd, 'inTelegramGroup'),
      note: clean(str(fd, 'note'), 600),
      updatedAt: new Date(),
    };
    const income = seesIncome(u.role) ? int(fd, 'monthlyIncome') : undefined;
    if (income != null && (income < 0 || income > 1_000_000_000)) throw new Error("Daromad noto'g'ri.");
    const set = income === undefined ? v : { ...v, monthlyIncome: income };
    await db.insert(graduates).values({ studentId, ...set }).onConflictDoUpdate({ target: graduates.studentId, set });
    return { message: "Bitiruvchi ma'lumotlari saqlandi" };
  });
}

/** Aloqa qayd etish: qachon, qanday, nima gaplashildi va keyingi aloqa sanasi */
export async function addGraduateContact(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await guard(studentId);
    const channel = str(fd, 'channel');
    if (!channel || !ALUMNI_CHANNELS.includes(channel)) throw new Error('Aloqa turini tanlang.');
    const date = dateOrNull(str(fd, 'date')) ?? today();
    if (date > today()) throw new Error("Aloqa sanasi kelajakda bo'lmaydi.");
    const s = await getSettings();
    const next = dateOrNull(str(fd, 'nextContactAt')) ?? (s.alumniContactDays ? addDays(date, s.alumniContactDays) : null);
    const note = clean(str(fd, 'note'), 600);
    await db.transaction(async (tx) => {
      await tx.insert(graduateContacts).values({ studentId, date, channel, note, byId: u.id });
      await tx
        .insert(graduates)
        .values({ studentId, lastContactAt: date, nextContactAt: next })
        .onConflictDoUpdate({ target: graduates.studentId, set: { lastContactAt: sql`greatest(${graduates.lastContactAt}, ${date}::date)`, nextContactAt: next, updatedAt: new Date() } });
      // Shu bitiruvchi bo'yicha ochiq "aloqa qiling" vazifasi bajarildi deb belgilanadi
      await tx.execute(sql`update tasks set status = 'bajarildi', done_at = now() where auto_key like ${`alumni:${studentId}:%`} and status <> 'bajarildi'`);
    });
    return { message: 'Aloqa qayd etildi' };
  });
}

/** Bitiruvchi kartasi: aloqalar tarixi, yutuqlari va tavsiya qilgan odamlari */
export async function graduateHistory(studentId: number) {
  await guard(studentId);
  const [contacts, wins, refs] = await Promise.all([
    db.execute<{ id: number; date: string; channel: string; note: string | null; by: string | null }>(sql`
      select c.id, c.date::text, c.channel, c.note, u.full_name by from graduate_contacts c left join users u on u.id = c.by_id where c.student_id = ${studentId} order by c.date desc, c.id desc limit 50`),
    db.execute<{ id: number; type: string; title: string; date: string }>(sql`select id, type, title, date::text from results where student_id = ${studentId} order by date desc limit 20`),
    db.execute<{ id: number; name: string; stage: string; created: string }>(sql`
      select id, full_name name, stage::text, to_char(created_at, 'YYYY-MM-DD') created from leads where referred_by_student_id = ${studentId} order by created_at desc limit 30`),
  ]);
  return { contacts: [...contacts], wins: [...wins], refs: [...refs] };
}
