'use server';
import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { coins, students } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, int } from '@/lib/action';
import { assertBranch } from '@/lib/branch';
import { assertOwnStudent } from '@/lib/access';
import { audit } from '@/lib/security';
import { siteUrl } from '@/lib/payments';
import { botInfo } from '@/lib/messaging';

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Ota-ona kabineti uchun yangi maxfiy havola. Havolaning o'zi bazada saqlanmaydi (faqat xeshi),
 * yangi havola yaratilsa eskisi darhol ishlamay qoladi. Telegram botga ulanish kodi ham yangilanadi.
 */
export async function createCabinetLink(studentId: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin'].includes(u.role)) throw new Error('Kabinet havolasini rahbar yoki administrator beradi.');
    await assertBranch('student', studentId);
    const token = randomBytes(24).toString('base64url');
    const code = randomBytes(12).toString('base64url');
    // Yangi havola — eski Telegram ulanishi ham uziladi; ulanish kodi 7 kun amal qiladi va faqat xeshi saqlanadi
    const r = await db.update(students).set({ cabinetHash: sha(token), telegramLinkCode: sha(code), telegramLinkExpires: new Date(Date.now() + 7 * 864e5), telegramChatId: null }).where(eq(students.id, studentId)).returning({ n: students.fullName });
    if (!r.length) throw new Error("O'quvchi topilmadi.");
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Ota-ona kabineti havolasi berildi', detail: r[0].n });
    const bot = await botInfo();
    return { message: 'Havola tayyor', url: `${siteUrl()}/ota-ona/${token}`, app: `${siteUrl()}/ilova/ulanish/${token}`, bot: bot ? `https://t.me/${bot.username}?start=${code}` : null };
  });
}

export async function revokeCabinetLink(studentId: number) {
  return run(async () => {
    const u = await assertSection('students');
    if (!['rahbar', 'admin'].includes(u.role)) throw new Error('Kabinet havolasini rahbar yoki administrator boshqaradi.');
    await assertBranch('student', studentId);
    await db.update(students).set({ cabinetHash: null, telegramLinkCode: null, telegramLinkExpires: null, telegramChatId: null }).where(eq(students.id, studentId));
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Ota-ona kabineti havolasi bekor qilindi', detail: String(studentId) });
    return { message: "Havola o'chirildi" };
  });
}

/** O'qituvchi yoki administrator qo'lda coin beradi/oladi (rag'bat yoki jarima) */
export async function giveCoins(studentId: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('students');
    if (u.role === 'bugalter' || u.role === 'sotuv') throw new Error("Coinni o'qituvchi yoki administrator beradi.");
    await assertBranch('student', studentId);
    await assertOwnStudent(u, studentId);
    const amount = int(fd, 'amount');
    if (!amount || Math.abs(amount) > 100) throw new Error("Coin -100 dan 100 gacha bo'lsin.");
    const reason = str(fd, 'reason')?.slice(0, 120);
    if (!reason) throw new Error('Sababini yozing.');
    // Kuniga bitta xodim jami 300 coindan ortiq bera olmaydi (tasodifiy yoki ataylab ko'p berilmasin)
    const [g] = await db.execute<{ s: number }>(sql`select coalesce(sum(abs(amount)), 0)::int s from coins where created_by_id = ${u.id} and created_at > now() - interval '1 day'`);
    if ((g?.s ?? 0) + Math.abs(amount) > 300) throw new Error("Bugun juda ko'p coin berildi. Ertaga davom eting.");
    await db.insert(coins).values({ studentId, amount, reason, createdById: u.id });
    return { message: amount > 0 ? `${amount} coin berildi` : `${-amount} coin olindi` };
  });
}
