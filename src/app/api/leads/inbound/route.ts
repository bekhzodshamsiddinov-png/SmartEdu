import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, ilike, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courses, leads } from '@/db/schema';
import { normalizePhone } from '@/lib/format';
import { notifyTelegram } from '@/lib/payments';

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
  const body = await req.text();
  if (body.length > 4096) return NextResponse.json({ ok: false }, { status: 413 });
  const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest();
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ ok: false }, { status: 401 });
  let d: { name?: unknown; phone?: unknown; course?: unknown; slug?: unknown; note?: unknown };
  try {
    d = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const name = String(d.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const phone = normalizePhone(String(d.phone ?? ''));
  if (name.length < 2 || !/^998\d{9}$/.test(phone)) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 422 });
  const courseText = String(d.course ?? '').trim().slice(0, 80);
  const note = [String(d.note ?? '').trim().slice(0, 300), courseText && `Qiziqqan kurs: ${courseText}`].filter(Boolean).join('. ');
  // Sayt kursi → CRM yo'nalishi: avval ma'lum slug bo'yicha kalit so'z, bo'lmasa nomning birinchi so'zi
  const SLUG_KEY: Record<string, string> = { foundation: 'Kompyuter', ai: 'intellekt', youtube: 'YouTube', fullstack: 'Fullstack' };
  const key = SLUG_KEY[String(d.slug ?? '')] ?? courseText.split(/[ —(’']/)[0];
  const [c] = key.length >= 2 ? await db.select({ id: courses.id }).from(courses).where(and(eq(courses.active, true), ilike(courses.name, `%${key.replace(/[%_\\]/g, '')}%`))).limit(1) : [];
  // Bir raqamdan 24 soat ichida takroriy ariza yangi lid emas
  const [dup] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.phone, phone), gt(leads.createdAt, sql`now() - interval '24 hours'`)));
  if (dup) return NextResponse.json({ ok: true, duplicate: true });
  await db.insert(leads).values({ fullName: name, phone, source: 'Sayt', courseId: c?.id ?? null, note: `uitc.uz arizasi${note ? `: ${note}` : ''}` });
  await notifyTelegram(`📝 uitc.uz dan ariza CRM ga tushdi: ${name}, +${phone}${courseText ? `\nKurs: ${courseText}` : ''}`);
  return NextResponse.json({ ok: true });
}
