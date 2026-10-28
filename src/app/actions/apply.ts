'use server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { branches, courses } from '@/db/schema';
import { normalizePhone } from '@/lib/format';
import { canonicalSource, clean, ingestLead } from '@/lib/leads-ingest';
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
    // Bir raqamdan sutkasiga 3 tadan ortiq ariza — e'tiborsiz (umumiy limitni egallab olmasin)
    if (await overLimit('ariza-phone', phone, 3, 1440)) return { ok: true };
    // Umumiy chegara: ko'p IP dan hujum bo'lsa ham soatiga 200 tadan ortiq ariza qabul qilinmaydi
    if (await overLimit('ariza-all', '*', 200, 60)) return { error: "Hozir arizalar ko'p. Iltimos, bizga qo'ng'iroq qiling." };
    const rawSource = String(fd.get('source') ?? '');
    const source = canonicalSource(rawSource, 'Akademiya sayti');
    const courseId = Number(fd.get('courseId')) || null;
    const course = courseId ? (await db.select({ id: courses.id, name: courses.name }).from(courses).where(and(eq(courses.id, courseId), eq(courses.active, true))))[0] : null;
    const branchId = Number(fd.get('branchId')) || null;
    const branch = branchId ? (await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.active, true))))[0] : null;
    const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null;
    const r = await ingestLead({
      name, phone, source, courseId: course?.id ?? null, branchId: branch?.id ?? null, via: 'ariza',
      campaign: clean(fd.get('utm_campaign'), 120), ad: clean(fd.get('utm_content'), 120),
      note: note ? `Saytdan ariza: ${note}` : 'Saytdan ariza',
    });
    if (!r.duplicate) await notifyTelegram(`📝 Yangi ariza: ${name}, +${phone}\nManba: ${source}${course ? `\nKurs: ${course.name}` : ''}`);
    return { ok: true };
  } catch {
    return { error: "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring yoki bizga qo'ng'iroq qiling." };
  }
}
