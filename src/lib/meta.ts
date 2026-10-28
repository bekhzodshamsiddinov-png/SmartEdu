import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { normalizePhone } from './format';
import { seal, unseal } from './sealed';
import { clean, ingestLead } from './leads-ingest';
import { notifyTelegram } from './payments';

/**
 * Instagram / Facebook lid formalari (Meta Lead Ads) → CRM.
 * Ikki yo'l bilan keladi, ikkalasi ham bitta navbatga (meta_leads) tushadi va leadgen_id bo'yicha takrorlanmaydi:
 *  1) Webhook — Meta lid tushishi bilan xabar beradi (bir necha soniyada);
 *  2) Zaxira sinxronlash — har 10 daqiqada oxirgi 2 kun lidlari tekshiriladi (webhook uzilsa ham lid yo'qolmaydi).
 */
const GRAPH = () => (process.env.META_GRAPH_URL || 'https://graph.facebook.com/v23.0').replace(/\/$/, '');

export type MetaSecret = { appSecret: string; pageToken?: string; pendingPages?: { id: string; name: string; token: string; ig: string | null }[] };
export type MetaForm = { id: string; name: string; status: string; branchId: number | null; courseId: number | null };
export type MetaInfo = {
  appId?: string;
  verifyToken?: string;
  pageId?: string;
  pageName?: string;
  igName?: string | null;
  subscribed?: boolean;
  forms?: MetaForm[];
  connectedAt?: string;
  lastEventAt?: string;
  lastSyncAt?: string;
  lastError?: string | null;
};

export async function loadMeta() {
  const [r] = await db.execute<{ secret: string | null; info: MetaInfo }>(sql`select secret, info from integrations where key = 'meta'`);
  return { secret: unseal<MetaSecret>(r?.secret), info: (r?.info ?? {}) as MetaInfo, exists: !!r };
}

export async function saveMeta(patch: { secret?: MetaSecret | null; info?: Partial<MetaInfo> }, userId?: number | null) {
  const cur = await loadMeta();
  const info = { ...cur.info, ...(patch.info ?? {}) };
  const secret = patch.secret === undefined ? (cur.secret ? seal(cur.secret) : null) : patch.secret ? seal(patch.secret) : null;
  await db.execute(sql`
    insert into integrations (key, secret, info, updated_by_id, updated_at) values ('meta', ${secret}, ${JSON.stringify(info)}::jsonb, ${userId ?? null}, now())
    on conflict (key) do update set secret = excluded.secret, info = excluded.info, updated_by_id = coalesce(excluded.updated_by_id, integrations.updated_by_id), updated_at = now()`);
  return info;
}

export const newVerifyToken = () => randomBytes(24).toString('base64url');

/** Meta xatosini foydalanuvchiga tushunarli, lekin tokenlarni oshkor qilmaydigan matnga aylantiradi */
export class GraphError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

function friendly(e: { message?: string; code?: number; error_subcode?: number }) {
  if (e.code === 190) return "Meta tokeni eskirgan yoki bekor qilingan — ulanishni qaytadan bajaring.";
  if (e.code === 10 || e.code === 200 || e.code === 100 && /permission/i.test(e.message ?? '')) return "Meta ruxsat bermadi: leads_retrieval va pages_manage_metadata ruxsatlari kerak.";
  if (e.code === 4 || e.code === 17 || e.code === 32) return "Meta so'rovlar chegarasiga yetildi — birozdan keyin o'zi davom etadi.";
  return (e.message ?? 'Meta bilan bog\'lanishda xato').replace(/access_token=[^&\s]+/g, 'access_token=***').slice(0, 200);
}

export async function graph<T>(path: string, opts: { token: string; appSecret?: string; params?: Record<string, string>; method?: 'GET' | 'POST' }): Promise<T> {
  const q = new URLSearchParams(opts.params ?? {});
  q.set('access_token', opts.token);
  // appsecret_proof: token o'g'irlansa ham App Secret'siz ishlatib bo'lmaydi
  if (opts.appSecret) q.set('appsecret_proof', createHmac('sha256', opts.appSecret).update(opts.token).digest('hex'));
  const url = `${GRAPH()}${path.startsWith('/') ? path : '/' + path}`;
  let res: Response;
  try {
    res = await fetch(opts.method === 'POST' ? url : `${url}?${q}`, {
      method: opts.method ?? 'GET',
      headers: opts.method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
      body: opts.method === 'POST' ? q.toString() : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw new GraphError("Meta serveriga ulanib bo'lmadi (tarmoq).");
  }
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || j.error) throw new GraphError(friendly(j.error ?? { message: `HTTP ${res.status}` }), j.error?.code);
  return j;
}

/** Ulanish 1-qadam: qisqa muddatli foydalanuvchi tokenini uzoq muddatliga almashtirib, sahifalar ro'yxatini oladi */
export async function exchangeAndListPages(appId: string, appSecret: string, userToken: string) {
  const ex = await graph<{ access_token: string }>('/oauth/access_token', {
    token: userToken,
    params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: userToken },
  });
  const pages = await graph<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { username?: string } }[] }>('/me/accounts', {
    token: ex.access_token,
    appSecret,
    params: { fields: 'id,name,access_token,instagram_business_account{username}', limit: '50' },
  });
  return (pages.data ?? []).map((p) => ({ id: String(p.id), name: String(p.name).slice(0, 100), token: p.access_token, ig: p.instagram_business_account?.username ?? null }));
}

export async function subscribePage(pageId: string, pageToken: string, appSecret: string) {
  await graph(`/${pageId}/subscribed_apps`, { token: pageToken, appSecret, method: 'POST', params: { subscribed_fields: 'leadgen' } });
}

export async function fetchForms(pageId: string, pageToken: string, appSecret: string) {
  const r = await graph<{ data: { id: string; name: string; status: string }[] }>(`/${pageId}/leadgen_forms`, {
    token: pageToken,
    appSecret,
    params: { fields: 'id,name,status', limit: '100' },
  });
  return (r.data ?? []).map((f) => ({ id: String(f.id), name: String(f.name ?? '').slice(0, 120), status: String(f.status ?? '') }));
}

type GraphLead = {
  id: string;
  created_time?: string;
  field_data?: { name: string; values: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
};

const LEAD_FIELDS = 'id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,platform,is_organic';

/** Navbatdagi bitta lidni Meta'dan olib, CRM ga yozadi */
async function processOne(row: { id: number; leadgen_id: string; form_id: string | null }, ctx: { token: string; appSecret: string; forms: MetaForm[] }) {
  try {
    const l = await graph<GraphLead>(`/${row.leadgen_id}`, { token: ctx.token, appSecret: ctx.appSecret, params: { fields: LEAD_FIELDS } });
    const fields = new Map<string, string>();
    for (const f of l.field_data ?? []) if (f?.name) fields.set(String(f.name).toLowerCase(), (f.values ?? []).map(String).join(', '));
    const pick = (...keys: string[]) => keys.map((k) => fields.get(k)).find((v) => v && v.trim());
    const name = clean(pick('full_name', 'name', 'ism', 'fio') ?? [pick('first_name'), pick('last_name')].filter(Boolean).join(' '), 80);
    const phoneRaw = pick('phone_number', 'phone', 'telefon', 'tel') ?? '';
    const phone = normalizePhone(phoneRaw);
    if (!/^\d{9,15}$/.test(phone)) throw new GraphError('Formada telefon raqam topilmadi');
    const used = new Set(['full_name', 'name', 'ism', 'fio', 'first_name', 'last_name', 'phone_number', 'phone', 'telefon', 'tel']);
    const answers = [...fields.entries()].filter(([k]) => !used.has(k)).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    const formId = l.form_id ?? row.form_id;
    const form = ctx.forms.find((f) => f.id === formId);
    let courseId = form?.courseId ?? null;
    if (!courseId && answers.length) {
      const text = answers.join(' ').toLowerCase();
      const cs = await db.execute<{ id: number; name: string }>(sql`select id, name from courses where active`);
      courseId = cs.find((c) => c.name.toLowerCase().split(/[\s,()—-]+/).filter((w) => w.length >= 4).some((w) => text.includes(w)))?.id ?? null;
    }
    const platform = String(l.platform ?? '').toLowerCase();
    // Organik (reklamasiz) forma — oddiy "Instagram"; reklama orqali — platformaga qarab target
    const source = l.is_organic ? 'Instagram' : platform === 'fb' ? 'Facebook target' : 'Instagram target';
    const r = await ingestLead({
      name: name ?? 'Ismsiz',
      phone,
      source,
      campaign: l.campaign_name ?? null,
      ad: l.ad_name ?? null,
      courseId,
      branchId: form?.branchId ?? null,
      externalId: `meta:${row.leadgen_id}`,
      via: 'meta',
      note: answers.length ? `Forma javoblari: ${answers.join('; ')}` : null,
      detail: [form?.name && `Forma: ${form.name}`, l.adset_name && `Auditoriya: ${l.adset_name}`].filter(Boolean).join('. ') || null,
    });
    await db.execute(sql`update meta_leads set status = 'qabul', lead_id = ${r.id}, error = null, attempts = attempts + 1, processed_at = now(), ad_id = coalesce(ad_id, ${l.ad_id ?? null}), form_id = coalesce(form_id, ${formId ?? null}) where id = ${row.id}`);
    if (!r.duplicate) await notifyTelegram(`📣 ${source}: yangi lid CRM ga tushdi — ${name ?? 'Ismsiz'}, +${phone}${l.campaign_name ? `\nKampaniya: ${l.campaign_name}` : ''}${l.ad_name ? `\nReklama: ${l.ad_name}` : ''}`);
    return true;
  } catch (e) {
    const msg = e instanceof GraphError ? e.message : 'Ichki xato';
    if (!(e instanceof GraphError)) console.error('[meta]', (e as Error)?.message?.slice(0, 200));
    await db.execute(sql`update meta_leads set status = 'xato', error = ${msg}, attempts = attempts + 1 where id = ${row.id}`);
    if (e instanceof GraphError && e.code === 190) await saveMeta({ info: { lastError: msg } });
    return false;
  }
}

/** Kutilayotgan va xato bo'lgan lidlarni qayta ishlaydi (urinishlar orasidagi kutish oshib boradi, 8 tadan keyin to'xtaydi) */
export async function processPending(limit = 20) {
  const { secret, info } = await loadMeta();
  if (!secret?.pageToken || !secret.appSecret) return 0;
  const rows = await db.execute<{ id: number; leadgen_id: string; form_id: string | null }>(sql`
    update meta_leads set status = 'jarayonda', processed_at = now()
    where id in (
      select id from meta_leads
      where (status = 'kutilmoqda' or (status = 'xato' and attempts < 8 and received_at < now() - (attempts * attempts || ' minutes')::interval)
        or (status = 'jarayonda' and processed_at < now() - interval '5 minutes'))
      order by id limit ${limit} for update skip locked)
    returning id, leadgen_id, form_id`);
  let ok = 0;
  for (const r of rows) if (await processOne(r, { token: secret.pageToken, appSecret: secret.appSecret, forms: info.forms ?? [] })) ok++;
  return ok;
}

/** Navbatga qo'shish (webhook yoki sinxronlash) — leadgen_id bo'yicha takrorlanmaydi */
export async function enqueueMetaLead(leadgenId: string, v: { pageId?: string | null; formId?: string | null; adId?: string | null }) {
  if (!/^\d{5,25}$/.test(leadgenId)) return false;
  const r = await db.execute(sql`
    insert into meta_leads (leadgen_id, page_id, form_id, ad_id) values (${leadgenId}, ${v.pageId ?? null}, ${v.formId ?? null}, ${v.adId ?? null})
    on conflict (leadgen_id) do nothing returning id`);
  return r.length > 0;
}

/** Zaxira: barcha formalardan oxirgi `hours` soat lidlarini olib, navbatga qo'shadi */
export async function syncRecent(hours = 48) {
  const { secret, info } = await loadMeta();
  if (!secret?.pageToken || !secret.appSecret || !info.pageId) return { added: 0, processed: 0 };
  let added = 0;
  try {
    const forms = await fetchForms(info.pageId, secret.pageToken, secret.appSecret);
    const keep = new Map((info.forms ?? []).map((f) => [f.id, f]));
    const merged = forms.map((f) => ({ ...f, branchId: keep.get(f.id)?.branchId ?? null, courseId: keep.get(f.id)?.courseId ?? null }));
    const since = Math.floor(Date.now() / 1000) - hours * 3600;
    for (const f of forms.filter((x) => x.status !== 'ARCHIVED' && x.status !== 'DELETED').slice(0, 40)) {
      const r = await graph<{ data: { id: string }[] }>(`/${f.id}/leads`, {
        token: secret.pageToken,
        appSecret: secret.appSecret,
        params: { fields: 'id', limit: '200', filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]) },
      });
      for (const l of r.data ?? []) if (await enqueueMetaLead(String(l.id), { pageId: info.pageId, formId: f.id })) added++;
    }
    await saveMeta({ info: { forms: merged, lastSyncAt: new Date().toISOString(), lastError: null } });
  } catch (e) {
    await saveMeta({ info: { lastSyncAt: new Date().toISOString(), lastError: e instanceof GraphError ? e.message : 'Sinxronlashda xato' } });
  }
  const processed = await processPending(50);
  return { added, processed };
}

/** CRM ishlatilayotganda har 10 daqiqada bir marta zaxira sinxronlash (kalit atomar band qilinadi) */
export async function metaHeartbeat() {
  const [m] = await db.execute<{ ok: boolean }>(sql`select (secret is not null and info ? 'pageId') ok from integrations where key = 'meta'`);
  if (!m?.ok) return;
  const bucket = Math.floor(Date.now() / 600_000);
  const r = await db.execute(sql`insert into job_runs (key) values (${`meta-sync:${bucket}`}) on conflict do nothing returning key`);
  if (r.length) await syncRecent(48);
  else await processPending(10);
}
