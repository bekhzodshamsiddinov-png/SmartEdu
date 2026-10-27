'use server';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students } from '@/db/schema';
import { addChild, getChildren, removeChild, SELECTED_COOKIE, tokenHash } from '@/lib/family';
import { clientIp, overLimit, audit } from '@/lib/security';
import { botInfo } from '@/lib/messaging';

/** Ota-ona havolasi orqali ilovaga farzandni qo'shish */
export async function joinFamily(token: string) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{30,64}$/.test(token)) redirect('/ilova/ulanish?xato=1');
  if (await overLimit('ilova-join', await clientIp(), 30, 10)) redirect('/ilova/ulanish?xato=2');
  const [s] = await db.execute<{ id: number; name: string; h: string }>(sql`select id, full_name name, cabinet_hash h from students where cabinet_hash = ${tokenHash(token)}`);
  if (!s) redirect('/ilova/ulanish?xato=1');
  await addChild(s.id, s.h);
  await setSelected(s.id);
  await audit({ actorType: 'oquvchi', actorId: s.id, actorName: s.name, action: 'Ota-ona ilovasiga ulandi', ip: await clientIp() });
  redirect('/ilova');
}

async function setSelected(id: number) {
  (await cookies()).set(SELECTED_COOKIE, String(id), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 });
}

export async function selectChild(id: number) {
  const kids = await getChildren();
  if (kids.some((k) => k.id === id)) await setSelected(id);
  redirect('/ilova');
}

export async function leaveChild(id: number) {
  await removeChild(id);
  const left = await getChildren();
  redirect(left.length ? '/ilova' : '/ilova/ulanish');
}

/** Telegram botga ulanish uchun bir martalik havola (7 kun amal qiladi) */
export async function telegramConnect(id: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  const kids = await getChildren();
  if (!kids.some((k) => k.id === id)) return { ok: false, error: 'Ruxsat yo\'q.' };
  const [cur] = await db.select({ chat: students.telegramChatId }).from(students).where(eq(students.id, id));
  // Ulangan Telegramni boshqa qurilmadan jimgina almashtirib bo'lmaydi: avval botda /stop
  if (cur?.chat) return { ok: false, error: "Telegram allaqachon ulangan. Almashtirish uchun avval botga /stop yuboring yoki administratorga murojaat qiling." };
  if (await overLimit('tg-link', String(id), 5, 60)) return { ok: false, error: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." };
  const bot = await botInfo();
  if (!bot) return { ok: false, error: 'Telegram bot hali ulanmagan. Markaz administratoriga murojaat qiling.' };
  const code = randomBytes(12).toString('base64url');
  await db
    .update(students)
    .set({ telegramLinkCode: createHash('sha256').update(code).digest('hex'), telegramLinkExpires: new Date(Date.now() + 7 * 864e5) })
    .where(eq(students.id, id));
  return { ok: true, url: `https://t.me/${bot.username}?start=${code}` };
}
