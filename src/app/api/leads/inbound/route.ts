import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { courses } from '@/db/schema';
import { clean, ingestLead } from '@/lib/leads-ingest';
import { normalizePhone } from '@/lib/format';
import { notifyTelegram } from '@/lib/payments';
import { overLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Tashqi saytdan (uitc.uz) kelgan arizalar. So'rov umumiy maxfiy kalit bilan imzolanadi:
 *   x-smartedu-signature = hex(HMAC-SHA256(LEAD_INBOUND_SECRET, `${ts}.${body}`)), ts — millisekund.
 * Imzosiz, eskirgan (5 daqiqadan oshgan) yoki katta so'rovlar rad etiladi.
 */
export async function POST(req: Request) {
  const secret = process.env.LEAD_INBOUND_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ ok: false }, { status: 404 });
  const ts = Number(req.headers.get('x-smartedu-timestamp'));
  const sig = req.headers.get('x-smartedu-signature') ?? '';
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000 || !/^[0-9a-f]{64}$/.test(sig)) return NextResponse.json({ ok: false }, { status: 401 });
  if (Number(req.headers.get('content-length') ?? '0') > 6144) return NextResponse.json({ ok: false }, { status: 413 });
  const body = await req.text();
  if (body.length > 6144) return NextResponse.json({ ok: false }, { status: 413 });
  const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest();
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ ok: false }, { status: 401 });
  let d: { name?: unknown; phone?: unknown; course?: unknown; slug?: unknown; note?: unknown; utm?: unknown; page?: unknown };
  try {
    d = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = String(d.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const phone = normalizePhone(String(d.phone ?? ''));
  if (name.length < 2 || !/^998\d{9}$/.test(phone)) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 422 });
  if (await overLimit('uitc-phone', phone, 5, 1440)) return NextResponse.json({ ok: true, duplicate: true });
  const courseText = String(d.course ?? '').trim().slice(0, 80);
  const note = [String(d.note ?? '').trim().slice(0, 300), courseText && `Qiziqqan kurs: ${courseText}`].filter(Boolean).join('. ');
  // Sayt kursi → CRM yo'nalishi: avval ma'lum slug bo'yicha kalit so'z, bo'lmasa nomning birinchi so'zi
  const SLUG_KEY: Record<string, string> = { foundation: 'Kompyuter', ai: 'intellekt', youtube: 'YouTube', fullstack: 'Fullstack' };
  const key = SLUG_KEY[String(d.slug ?? '')] ?? courseText.split(/[ —(’']/)[0];
  const [c] = key.length >= 2 ? await db.select({ id: courses.id }).from(courses).where(and(eq(courses.active, true), ilike(courses.name, `%${key.replace(/[%_\\]/g, '')}%`))).limit(1) : [];
  const m = siteSource(d.utm);
  const page = clean(d.page, 120);
  const r = await ingestLead({
    name, phone, source: m.source, campaign: m.campaign, ad: m.ad, courseId: c?.id ?? null,
    note: `uitc.uz arizasi${note ? `: ${note}` : ''}`, via: 'uitc',
    detail: [page && `Sahifa: ${page}`, m.raw].filter(Boolean).join('. ') || null,
  });
  if (!r.duplicate) await notifyTelegram(`📝 uitc.uz dan ariza CRM ga tushdi: ${name}, +${phone}\nManba: ${m.source}${m.campaign ? `, ${m.campaign}` : ''}${courseText ? `\nKurs: ${courseText}` : ''}`);
  return NextResponse.json({ ok: true, duplicate: r.duplicate });
}

/**
 * Saytga reklama havolasi orqali kelgan bo'lsa (utm belgilari) — haqiqiy kanal: Instagram target, Telegram...
 * Belgisiz kelgan bo'lsa — "uitc.uz".
 */
function siteSource(raw: unknown): { source: string; campaign: string | null; ad: string | null; raw: string | null } {
  const u = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const g = (k: string) => clean(u[k], 120);
  const src = (g('utm_source') ?? '').toLowerCase();
  const med = (g('utm_medium') ?? '').toLowerCase();
  const paid = /cpc|paid|ads?|target|ppc|cpm|reklama/.test(med) || !!g('fbclid');
  let source = 'uitc.uz';
  if (/^(ig|instagram)/.test(src)) source = paid ? 'Instagram target' : 'Instagram';
  else if (/^(fb|facebook|meta)/.test(src)) source = paid ? 'Facebook target' : 'Instagram';
  else if (/telegram|^tg/.test(src)) source = 'Telegram';
  else if (!src && g('fbclid')) source = 'Instagram target';
  const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => (g(k) ? `${k}=${g(k)}` : null)).filter(Boolean);
  return { source, campaign: g('utm_campaign'), ad: g('utm_content'), raw: parts.length ? parts.join(', ') : null };
}
