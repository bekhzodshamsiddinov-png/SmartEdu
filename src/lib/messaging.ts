import 'server-only';
import { createHmac } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { messageTemplates, outbox, students } from '@/db/schema';
import { getSettings } from './settings';
import { money, phone as fmtPhone } from './format';
import { siteUrl } from './payments';

export const EVENTS: { key: string; label: string; vars: string[]; hint: string }[] = [
  { key: 'tolov', label: "To'lov qabul qilindi", vars: ['oquvchi', 'summa', 'qoldiq', 'markaz'], hint: "Har bir to'lovdan keyin darhol" },
  { key: 'kelmadi', label: 'Darsga kelmadi', vars: ['oquvchi', 'guruh', 'sana', 'telefon', 'markaz'], hint: 'Davomatda "Kelmadi" belgilanganda' },
  { key: 'qarz', label: 'Qarz eslatmasi', vars: ['oquvchi', 'qarz', 'markaz'], hint: "Har oy to'lov muddatidan keyingi kuni, qarz chegaradan oshsa" },
  { key: 'tugilgan_kun', label: "Tug'ilgan kun", vars: ['oquvchi', 'markaz'], hint: "Tug'ilgan kuni ertalab" },
  { key: 'birinchi_dars', label: 'Birinchi dars eslatmasi', vars: ['oquvchi', 'guruh', 'vaqt', 'manzil', 'markaz'], hint: 'Birinchi darsdan bir kun oldin' },
];

export const smsConfigured = () => !!(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
export const botConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;

/** Telegram webhook maxfiy kaliti — AUTH_SECRET dan hosil qilinadi, alohida sozlama shart emas */
export function telegramWebhookSecret() {
  return createHmac('sha256', process.env.AUTH_SECRET ?? '').update('telegram-webhook').digest('hex').slice(0, 48);
}

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).slice(0, 900);
}

/**
 * Hodisa bo'yicha xabarni navbatga qo'yadi. Ota-ona Telegram botga ulangan bo'lsa — Telegram, aks holda SMS.
 * dedupeKey bir xil xabar ikki marta ketmasligini kafolatlaydi.
 */
export async function enqueue(event: string, studentId: number, vars: Record<string, string | number>, dedupeKey: string) {
  try {
    const [t] = await db.select().from(messageTemplates).where(eq(messageTemplates.event, event));
    if (!t || !t.active) return;
    const [s] = await db
      .select({ name: students.fullName, phone: students.phone, parentPhone: students.parentPhone, chat: students.telegramChatId, branchId: students.branchId })
      .from(students)
      .where(eq(students.id, studentId));
    if (!s) return;
    const set = await getSettings();
    const all: Record<string, string> = { oquvchi: s.name, markaz: set.centerName, telefon: set.phone ? fmtPhone(set.phone) : '', manzil: set.address ?? '' };
    for (const [k, v] of Object.entries(vars)) all[k] = String(v);
    const to = s.chat && botConfigured() ? s.chat : (s.parentPhone || s.phone);
    if (!to) return;
    await db
      .insert(outbox)
      .values({ event, studentId, branchId: s.branchId, channel: s.chat && botConfigured() ? 'telegram' : 'sms', to, body: render(t.body, all), dedupeKey })
      .onConflictDoNothing();
  } catch {
    // Xabar navbati asosiy amalni (to'lov, davomat) hech qachon buzmasligi kerak
  }
}

export const moneyVar = (n: number) => money(n);

let eskizToken: { v: string; at: number } | null = null;
async function eskiz(): Promise<string> {
  if (eskizToken && Date.now() - eskizToken.at < 20 * 3600 * 1000) return eskizToken.v;
  const fd = new FormData();
  fd.set('email', process.env.ESKIZ_EMAIL!);
  fd.set('password', process.env.ESKIZ_PASSWORD!);
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: fd, signal: AbortSignal.timeout(8000) });
  const j = (await r.json().catch(() => ({}))) as { data?: { token?: string } };
  if (!r.ok || !j.data?.token) throw new Error('Eskiz: kirish xatosi');
  eskizToken = { v: j.data.token, at: Date.now() };
  return eskizToken.v;
}

async function sendSms(to: string, text: string) {
  const token = await eskiz();
  const fd = new FormData();
  fd.set('mobile_phone', to);
  fd.set('message', text);
  fd.set('from', process.env.ESKIZ_FROM || '4546');
  const r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Eskiz: ${r.status}`);
}

export async function sendTelegram(chat: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`Telegram: ${r.status}`);
}

/**
 * Navbatdagi xabarlarni yuborish. Kanal ulanmagan bo'lsa xabar "qo'lda" holatiga o'tadi —
 * administrator Xabarlar bo'limidan nusxalab yuboradi.
 */
export async function flushOutbox(limit = 30) {
  // Bir vaqtda ikki jarayon bir xabarni olmasligi uchun: avval "yuborilmoqda" deb band qilamiz
  const rows = await db.execute<{ id: number; channel: string; to: string; body: string }>(sql`
    update outbox set status = 'yuborilmoqda', attempts = attempts + 1
    where id in (select id from outbox where status = 'navbatda' order by id limit ${limit} for update skip locked)
    returning id, channel, "to", body`);
  for (const m of rows) {
    try {
      if (m.channel === 'telegram' && botConfigured()) await sendTelegram(m.to, m.body);
      else if (m.channel === 'sms' && smsConfigured()) await sendSms(m.to, m.body);
      else {
        await db.update(outbox).set({ status: 'qolda' }).where(eq(outbox.id, m.id));
        continue;
      }
      await db.update(outbox).set({ status: 'yuborildi', sentAt: new Date(), error: null }).where(eq(outbox.id, m.id));
    } catch (e) {
      await db
        .update(outbox)
        .set({ status: 'xato', error: (e as Error).message.slice(0, 200) })
        .where(eq(outbox.id, m.id));
    }
  }
  return rows.length;
}

export async function retryFailed(ids: number[]) {
  if (!ids.length) return;
  await db.update(outbox).set({ status: 'navbatda' }).where(and(inArray(outbox.id, ids), inArray(outbox.status, ['xato', 'qolda'])));
}

export async function botInfo(): Promise<{ username: string } | null> {
  if (!botConfigured()) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    const j = (await r.json()) as { ok: boolean; result?: { username: string } };
    return j.ok && j.result ? { username: j.result.username } : null;
  } catch {
    return null;
  }
}

export function webhookUrl() {
  return `${siteUrl()}/api/telegram`;
}
