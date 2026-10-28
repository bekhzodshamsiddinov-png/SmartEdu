import { NextResponse, after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { enqueueMetaLead, loadMeta, processPending, saveMeta } from '@/lib/meta';
import { safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Meta webhook (Instagram/Facebook lid formalari).
 * GET  — Meta manzilni tasdiqlaydi: hub.verify_token bizdagi tasodifiy token bilan mos kelishi shart.
 * POST — har bir so'rov App Secret bilan imzolangan (X-Hub-Signature-256). Imzosiz so'rov rad etiladi.
 * Faqat ulangan sahifa lidlari qabul qilinadi; tafsilotlar keyin Meta'dan token bilan olinadi
 * (webhook'ning o'zida shaxsiy ma'lumot yo'q — faqat leadgen_id).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const { info, secret } = await loadMeta();
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token') ?? '';
  const challenge = u.searchParams.get('hub.challenge') ?? '';
  if (!secret?.appSecret || !info.verifyToken) return new NextResponse('Not found', { status: 404 });
  if (mode !== 'subscribe' || !safeEqual(token, info.verifyToken) || !/^[\w.-]{1,128}$/.test(challenge)) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
}

export async function POST(req: Request) {
  const { info, secret } = await loadMeta();
  if (!secret?.appSecret) return new NextResponse('Not found', { status: 404 });
  if (Number(req.headers.get('content-length') ?? '0') > 256 * 1024) return new NextResponse('Too large', { status: 413 });
  const body = await req.text();
  if (body.length > 256 * 1024) return new NextResponse('Too large', { status: 413 });
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  const m = /^sha256=([0-9a-f]{64})$/.exec(sig);
  const expected = createHmac('sha256', secret.appSecret).update(body).digest();
  if (!m || !timingSafeEqual(Buffer.from(m[1], 'hex'), expected)) return new NextResponse('Bad signature', { status: 401 });
  let d: { object?: string; entry?: { id?: string; changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  try {
    d = JSON.parse(body);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }
  let added = 0;
  for (const e of (d.entry ?? []).slice(0, 50)) {
    for (const c of (e.changes ?? []).slice(0, 50)) {
      if (c.field !== 'leadgen' || !c.value) continue;
      const pageId = String(c.value.page_id ?? e.id ?? '');
      if (info.pageId && pageId !== info.pageId) continue;
      if (await enqueueMetaLead(String(c.value.leadgen_id ?? ''), { pageId, formId: c.value.form_id ? String(c.value.form_id) : null, adId: c.value.ad_id ? String(c.value.ad_id) : null })) added++;
    }
  }
  // Meta 20 soniya ichida javob kutadi — lid tafsilotlari javobdan keyin olinadi
  after(async () => {
    if (added) await saveMeta({ info: { lastEventAt: new Date().toISOString() } });
    await processPending(20);
  });
  return new NextResponse('EVENT_RECEIVED', { status: 200 });
}
