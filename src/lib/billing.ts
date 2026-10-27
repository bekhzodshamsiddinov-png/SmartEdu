import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attendance, charges, enrollments, groups, reasons } from '@/db/schema';
import { getSettings } from './settings';
import { groupHasLessonOn, monthEnd, monthStart, today } from './dates';

/**
 * O'quvchi hisob daftari.
 *  - Balans = to'lovlar (bekor qilinmagan) − yechimlar (charges)
 *  - "oylik" guruh: har oy uchun bitta yechim (oy boshida), oylik narx
 *  - "dars" guruh: har bir hisobga olinadigan dars uchun yechim = oylik narx / shu oydagi darslar soni
 */

/** Shu oyda guruhning nechta dars kuni bor */
export function lessonsInMonth(days: string, month: string) {
  let n = 0;
  const end = monthEnd(month);
  for (let d = monthStart(month); d <= end; d = nextDay(d)) if (groupHasLessonOn(days, d)) n++;
  return n;
}

function nextDay(d: string) {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

/** Bitta dars narxi (so'm, butun) */
export function lessonPrice(monthlyFee: number, days: string, date: string) {
  const n = lessonsInMonth(days, date.slice(0, 7));
  return n ? Math.round(monthlyFee / n) : 0;
}

/** Oylik hisobda birinchi oy qisman: qo'shilgan kundan oy oxirigacha bo'lgan darslar ulushi */
function firstMonthAmount(fee: number, days: string, start: string) {
  const month = start.slice(0, 7);
  const total = lessonsInMonth(days, month);
  if (!total) return fee;
  let left = 0;
  for (let d = start; d <= monthEnd(month); d = nextDay(d)) if (groupHasLessonOn(days, d)) left++;
  return Math.round((fee * left) / total);
}

let lastEnsure = 0;
/**
 * "Oylik" guruhlardagi o'quvchilar uchun shu oygacha bo'lgan oylik yechimlarni yaratadi.
 * Takroriy chaqiruvga chidamli (unikal indeks), shuning uchun istalgan joydan chaqirish xavfsiz.
 */
export async function ensureMonthlyCharges(force = false) {
  if (!force && Date.now() - lastEnsure < 60_000) return;
  lastEnsure = Date.now();
  const t = today();
  const s = await getSettings();
  if (s.prorateFirstMonth) {
    // Birinchi oyni qisman hisoblash uchun yangi oylarni bittadan qo'shamiz
    const missing = await db.execute<{ id: number; student_id: number; group_id: number; monthly_fee: number; start_date: string; days: string; m: string }>(sql`
      select e.id, e.student_id, e.group_id, e.monthly_fee, e.start_date::text, g.days, to_char(m.d, 'YYYY-MM') m
      from enrollments e join groups g on g.id = e.group_id
      cross join lateral generate_series(date_trunc('month', e.start_date), date_trunc('month', least(coalesce(e.end_date, ${t}::date), ${t}::date)), interval '1 month') m(d)
      where g.billing = 'oylik' and e.start_date <= ${t}::date
        and not exists (select 1 from charges c where c.enrollment_id = e.id and c.kind = 'oylik' and c.month = to_char(m.d, 'YYYY-MM'))
        and not exists (select 1 from charges c where c.student_id = e.student_id and c.group_id = e.group_id and c.enrollment_id <> e.id and c.kind = 'oylik' and c.month = to_char(m.d, 'YYYY-MM'))`);
    for (const r of missing) {
      const first = r.m === r.start_date.slice(0, 7);
      const amount = first ? firstMonthAmount(r.monthly_fee, r.days, r.start_date) : r.monthly_fee;
      await db
        .insert(charges)
        .values({ studentId: r.student_id, enrollmentId: r.id, groupId: r.group_id, kind: 'oylik', amount, date: first ? r.start_date : `${r.m}-01`, month: r.m })
        .onConflictDoNothing();
    }
    return;
  }
  await db.execute(sql`
    insert into charges (student_id, enrollment_id, group_id, kind, amount, date, month)
    select e.student_id, e.id, e.group_id, 'oylik', e.monthly_fee, greatest(m.d::date, e.start_date), to_char(m.d, 'YYYY-MM')
    from enrollments e join groups g on g.id = e.group_id
    cross join lateral generate_series(date_trunc('month', e.start_date), date_trunc('month', least(coalesce(e.end_date, ${t}::date), ${t}::date)), interval '1 month') m(d)
    where g.billing = 'oylik' and e.start_date <= ${t}::date
      -- Shu oy shu guruhda avval hisoblangan bo'lsa (muzlatib qaytgan, qayta yozilgan) — ikkinchi marta yechilmaydi
      and not exists (select 1 from charges c where c.student_id = e.student_id and c.group_id = e.group_id and c.enrollment_id <> e.id and c.kind = 'oylik' and c.month = to_char(m.d, 'YYYY-MM'))
    on conflict do nothing`);
}

/**
 * Bir guruhning bir kunlik davomatidan keyin "dars" hisobidagi yechimlarni moslaydi:
 * kelgan / kechikkan — yechiladi; sababsiz — sozlamaga ko'ra; sababli — sabab turiga ko'ra.
 */
export async function syncLessonCharges(groupId: number, date: string, byUserId?: number) {
  const [g] = await db.select({ billing: groups.billing, days: groups.days }).from(groups).where(eq(groups.id, groupId));
  if (!g || g.billing !== 'dars') return;
  const s = await getSettings();
  const rows = await db
    .select({ id: attendance.id, studentId: attendance.studentId, status: attendance.status, reasonId: attendance.reasonId })
    .from(attendance)
    .where(and(eq(attendance.groupId, groupId), eq(attendance.date, date)));
  if (!rows.length) return;
  const rIds = rows.map((r) => r.reasonId).filter((x): x is number => !!x);
  const rs = rIds.length ? await db.select({ id: reasons.id, charges: reasons.charges }).from(reasons).where(inArray(reasons.id, rIds)) : [];
  const chargeable = new Map(rs.map((r) => [r.id, r.charges]));
  const enr = await db.execute<{ id: number; student_id: number; monthly_fee: number }>(sql`
    select id, student_id, monthly_fee from enrollments
    where group_id = ${groupId} and start_date <= ${date} and (end_date is null or end_date >= ${date})`);
  const enrBy = new Map(enr.map((e) => [e.student_id, e]));
  for (const a of rows) {
    const e = enrBy.get(a.studentId);
    const charge =
      !!e &&
      (a.status === 'keldi' ||
        a.status === 'kechikdi' ||
        (a.status === 'kelmadi' && s.chargeAbsent) ||
        (a.status === 'sababli' && !!a.reasonId && !!chargeable.get(a.reasonId)));
    if (!charge) {
      await db.delete(charges).where(eq(charges.attendanceId, a.id));
      continue;
    }
    const amount = lessonPrice(e!.monthly_fee, g.days, date);
    await db
      .insert(charges)
      .values({ studentId: a.studentId, enrollmentId: e!.id, groupId, kind: 'dars', amount, date, month: date.slice(0, 7), attendanceId: a.id, createdById: byUserId ?? null })
      .onConflictDoUpdate({ target: charges.attendanceId, targetWhere: sql`attendance_id is not null`, set: { amount, enrollmentId: e!.id } });
  }
}

/** Oylik narx o'zgarsa — joriy oyning oylik yechimi ham yangilanadi (o'tgan oylar o'zgarmaydi) */
/**
 * Narx o'zgarganda joriy oyning oylik yechimi yangilanadi. Faqat oddiy (to'liq) yechim o'zgaradi:
 * ko'chirilganda qo'yilgan 0 yozuv (izohli) va qisman hisoblangan birinchi oy o'zgarmaydi.
 */
export async function syncCurrentMonthFee(enrollmentId: number, fee: number, oldFee: number) {
  await db.execute(sql`
    update charges set amount = ${fee}
    where enrollment_id = ${enrollmentId} and kind = 'oylik' and month = ${today().slice(0, 7)} and note is null and amount = ${oldFee}`);
}

export async function enrollmentById(id: number) {
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, id));
  return e;
}
