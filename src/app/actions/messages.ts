'use server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { messageTemplates, outbox } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str } from '@/lib/action';
import { lockedBranch } from '@/lib/branch';
import { EVENTS, botConfigured, flushOutbox, telegramWebhookSecret, webhookUrl } from '@/lib/messaging';
import { audit } from '@/lib/security';

export async function saveTemplate(event: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('messages');
    if (u.role !== 'rahbar') throw new Error('Xabar matnini rahbar o\'zgartiradi.');
    if (!EVENTS.some((e) => e.key === event)) throw new Error('Hodisa topilmadi.');
    const body = str(fd, 'body');
    if (!body || body.length < 5) throw new Error('Xabar matnini yozing.');
    if (body.length > 600) throw new Error('Xabar 600 belgidan oshmasin.');
    const active = fd.get('active') === 'on';
    await db.insert(messageTemplates).values({ event, body, active }).onConflictDoUpdate({ target: messageTemplates.event, set: { body, active, updatedAt: new Date() } });
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Xabar shabloni o\'zgartirildi', detail: event });
    return { message: 'Shablon saqlandi' };
  });
}

/** Filialga biriktirilgan administrator faqat o'z filiali xabarlarini boshqaradi */
async function scopeIds(ids: number[]) {
  const locked = await lockedBranch();
  const clean = ids.filter((x) => Number.isInteger(x) && x > 0).slice(0, 200);
  if (!clean.length) return [];
  const rows = await db.select({ id: outbox.id, b: outbox.branchId }).from(outbox).where(inArray(outbox.id, clean));
  return rows.filter((r) => !locked || !r.b || r.b === locked).map((r) => r.id);
}

/** Qo'lda yuborilgan xabarni "yuborildi" deb belgilash */
export async function markSent(id: number) {
  return run(async () => {
    await assertSection('messages');
    const [ok] = await scopeIds([id]);
    if (!ok) throw new Error('Xabar topilmadi.');
    await db.update(outbox).set({ status: 'yuborildi', sentAt: new Date() }).where(and(eq(outbox.id, ok), inArray(outbox.status, ['qolda', 'xato', 'navbatda'])));
    return { message: 'Yuborildi deb belgilandi' };
  });
}

export async function cancelMessage(id: number) {
  return run(async () => {
    await assertSection('messages');
    const [ok] = await scopeIds([id]);
    if (!ok) throw new Error('Xabar topilmadi.');
    await db.update(outbox).set({ status: 'bekor' }).where(and(eq(outbox.id, ok), inArray(outbox.status, ['qolda', 'xato', 'navbatda'])));
    return { message: 'Bekor qilindi' };
  });
}

export async function retryMessages() {
  return run(async () => {
    await assertSection('messages');
    const locked = await lockedBranch();
    const rows = await db.select({ id: outbox.id, b: outbox.branchId }).from(outbox).where(inArray(outbox.status, ['xato', 'qolda']));
    const ids = rows.filter((r) => !locked || !r.b || r.b === locked).map((r) => r.id);
    if (ids.length) await db.update(outbox).set({ status: 'navbatda' }).where(inArray(outbox.id, ids));
    const n = await flushOutbox(50);
    return { message: n ? `${n} ta xabar qayta ishlandi` : "Navbatda xabar yo'q" };
  });
}

/** Telegram botni ota-onalar uchun ulash (webhook o'rnatish) */
export async function connectBot() {
  return run(async () => {
    const u = await assertSection('messages');
    if (u.role !== 'rahbar') throw new Error('Botni rahbar ulaydi.');
    if (!botConfigured()) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan.");
    if (!webhookUrl().startsWith('https://')) throw new Error('Bot faqat https manzilda ishlaydi (prod saytda ulang).');
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl(), secret_token: telegramWebhookSecret(), allowed_updates: ['message'], drop_pending_updates: true }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!j.ok) throw new Error(`Telegram: ${j.description ?? 'ulanmadi'}`);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Telegram bot ulandi', detail: webhookUrl() });
    return { message: 'Bot ulandi' };
  });
}
