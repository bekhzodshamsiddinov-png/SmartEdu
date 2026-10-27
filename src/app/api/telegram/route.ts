import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { students } from '@/db/schema';
import { safeEqual } from '@/lib/security';
import { botConfigured, sendTelegram, telegramWebhookSecret } from '@/lib/messaging';
import { getBalances } from '@/lib/finance';
import { money } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

type Update = { message?: { chat?: { id?: number; type?: string }; text?: string } };

/**
 * Ota-onalar uchun Telegram bot webhooki.
 * Telegram har so'rovda maxfiy sarlavha yuboradi — boshqa hech kim bu manzilga soxta xabar yubora olmaydi.
 */
export async function POST(req: Request) {
  if (!botConfigured() || !process.env.AUTH_SECRET) return NextResponse.json({ ok: true });
  const secret = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!safeEqual(secret, telegramWebhookSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  const u = (await req.json().catch(() => ({}))) as Update;
  const chatId = u.message?.chat?.id;
  const text = (u.message?.text ?? '').trim();
  if (!chatId || u.message?.chat?.type !== 'private') return NextResponse.json({ ok: true });
  const chat = String(chatId);
  const s = await getSettings();
  try {
    if (text.startsWith('/start')) {
      const code = text.slice(6).trim();
      if (!/^[A-Za-z0-9_-]{10,64}$/.test(code)) {
        await sendTelegram(chat, `Assalomu alaykum! Bu ${s.centerName} ning ota-onalar boti.\nUlanish uchun markaz administratori bergan havolani bosing.`);
        return NextResponse.json({ ok: true });
      }
      const r = await db.execute<{ full_name: string }>(sql`
        update students set telegram_chat_id = ${chat}, telegram_link_code = null where telegram_link_code = ${code} returning full_name`);
      await sendTelegram(
        chat,
        r.length
          ? `✅ Ulandingiz: ${r[0].full_name}.\nEndi to'lov, davomat va eslatmalar shu yerga keladi.\nBalansni bilish: /balans`
          : "Havola eskirgan yoki allaqachon ishlatilgan. Administratordan yangi havola so'rang.",
      );
    } else if (text === '/balans') {
      const kids = await db.select({ id: students.id, name: students.fullName }).from(students).where(eq(students.telegramChatId, chat));
      if (!kids.length) await sendTelegram(chat, 'Hech qaysi o\'quvchiga ulanmagansiz.');
      else {
        const b = await getBalances();
        await sendTelegram(chat, kids.map((k) => { const v = b.get(k.id)?.balance ?? 0; return `${k.name}: ${v < 0 ? `qarz ${money(-v)}` : `hisobda ${money(v)}`}`; }).join('\n'));
      }
    } else if (text === '/stop') {
      await db.update(students).set({ telegramChatId: null }).where(eq(students.telegramChatId, chat));
      await sendTelegram(chat, "Xabarnomalar o'chirildi. Qayta ulanish uchun administratordan havola so'rang.");
    } else {
      await sendTelegram(chat, 'Buyruqlar: /balans — hisob holati, /stop — xabarnomalarni o\'chirish.');
    }
  } catch {
    // Telegram javobi muvaffaqiyatsiz bo'lsa ham 200 qaytaramiz — aks holda Telegram qayta-qayta yuboradi
  }
  return NextResponse.json({ ok: true });
}
