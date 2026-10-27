import 'server-only';

/** Click va Payme sozlamalari muhit o'zgaruvchilaridan olinadi. Kalitlar qo'yilmaguncha bu usullar ko'rinmaydi. */
export const clickConfig = () => {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const secret = process.env.CLICK_SECRET_KEY;
  return serviceId && merchantId && secret ? { serviceId, merchantId, secret } : null;
};

export const paymeConfig = () => {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  const key = process.env.PAYME_KEY;
  return merchantId && key ? { merchantId, key, test: process.env.PAYME_TEST === '1' } : null;
};

export function clickPayUrl(orderId: number, amount: number, returnUrl: string) {
  const c = clickConfig();
  if (!c) return null;
  const q = new URLSearchParams({ service_id: c.serviceId, merchant_id: c.merchantId, amount: String(amount), transaction_param: String(orderId), return_url: returnUrl });
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

export function paymePayUrl(orderId: number, amount: number, returnUrl: string) {
  const p = paymeConfig();
  if (!p) return null;
  const params = `m=${p.merchantId};ac.order_id=${orderId};a=${amount * 100};c=${returnUrl};l=uz`;
  return `${p.test ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz'}/${Buffer.from(params).toString('base64')}`;
}

/** Yangi buyurtma yoki to'lov haqida Telegramga xabar (TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID qo'yilgan bo'lsa) */
export async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Foydalanuvchi kiritgan matn xabarni soxtalashtira olmasin: uzunlik cheklanadi, boshqaruv belgilari olinadi
      body: JSON.stringify({ chat_id: chat, text: text.replace(/[\u0000-\u0009\u000b-\u001f\u007f\u0085\u2028\u2029]/g, ' ').slice(0, 3500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // xabar yuborilmasa ham asosiy jarayon to'xtamaydi
  }
}

export function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3100';
}
