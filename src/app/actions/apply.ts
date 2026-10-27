'use server';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { branches, courses, leads } from '@/db/schema';
import { normalizePhone } from '@/lib/format';
import { LEAD_SOURCES } from '@/lib/constants';
import { clientIp, overLimit } from '@/lib/security';
import { notifyTelegram } from '@/lib/payments';

export type ApplyState = { ok?: boolean; error?: string } | undefined;

/**
 * Saytdagi ommaviy ariza formasi (manba havolasi orqali): yangi lid yaratadi.
 * Himoya: IP bo'yicha limit, bot tuzog'i (yashirin maydon), raqam formati, bir raqamdan 24 soatda bitta lid.
 */
export async function submitApplication(_: ApplyState, fd: FormData): Promise<ApplyState> {
  try {
    if (String(fd.get('website') ?? '')) return { ok: true }; // bot tuzog'i: odam bu maydonni ko'rmaydi
    const ip = await clientIp();
    if (await overLimit('ariza', ip, 5, 60)) return { error: "Juda ko'p ariza yuborildi. Birozdan keyin urinib ko'ring." };
    const name = String(fd.get('fullName') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 2) return { error: 'Ismingizni yozing.' };
    const phone = normalizePhone(String(fd.get('phone') ?? ''));
    if (!/^998\d{9}$/.test(phone)) return { error: "Telefon raqamni to'g'ri kiriting: 90 123 45 67." };
    const rawSource = String(fd.get('source') ?? '');
    const source = LEAD_SOURCES.find((x) => x.toLowerCase() === rawSource.toLowerCase()) ?? 'Sayt';
    const courseId = Number(fd.get('courseId')) || null;
    const course = courseId ? (await db.select({ id: courses.id, name: courses.name }).from(courses).where(and(eq(courses.id, courseId), eq(courses.active, true))))[0] : null;
    const branchId = Number(fd.get('branchId')) || null;
    const branch = branchId ? (await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.active, true))))[0] : null;
    const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null;
    // Bir raqamdan 24 soat ichida takroriy ariza — yangi lid emas
    const [dup] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.phone, phone), gt(leads.createdAt, sql`now() - interval '24 hours'`)));
    if (dup) return { ok: true };
    await db.insert(leads).values({ fullName: name, phone, source, courseId: course?.id ?? null, branchId: branch?.id ?? null, note: note ? `Saytdan ariza: ${note}` : 'Saytdan ariza' });
    await notifyTelegram(`📝 Yangi ariza: ${name}, +${phone}\nManba: ${source}${course ? `\nKurs: ${course.name}` : ''}`);
    return { ok: true };
  } catch {
    return { error: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring yoki bizga qo'ng'iroq qiling." };
  }
}
