import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { LEAD_SOURCES } from './constants';
import { getSettings } from './settings';

/** Eski yozuvlar va eski havolalar uchun: 'Target' → 'Instagram target' va h.k. */
const LEGACY: Record<string, string> = { target: 'Instagram target', sayt: 'Akademiya sayti', 'instagram reklama': 'Instagram target' };

export function canonicalSource(raw: string | null | undefined, fallback = 'Boshqa') {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return fallback;
  return LEAD_SOURCES.find((x) => x.toLowerCase() === v) ?? LEGACY[v] ?? fallback;
}

/** Matnni bir qatorga keltirib, uzunligini cheklaydi (reklama nomlari, izohlar) */
export function clean(v: unknown, max: number) {
  const s = String(v ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return s || null;
}

export type IngestInput = {
  name: string;
  phone: string;
  source: string;
  campaign?: string | null;
  ad?: string | null;
  courseId?: number | null;
  branchId?: number | null;
  note?: string | null;
  /** Tashqi tizimdagi identifikator (Meta leadgen_id) — ikki marta tushmasligi uchun */
  externalId?: string | null;
  via: 'qolda' | 'meta' | 'uitc' | 'ariza';
  detail?: string | null;
  createdById?: number | null;
  assignedToId?: number | null;
  referredByStudentId?: number | null;
  trialDate?: string | null;
};

export type IngestResult = { id: number; duplicate: boolean; reopened: boolean; name: string; studentName: string | null };

/**
 * Barcha kanallar uchun yagona kirish nuqtasi.
 * - Bir raqam ikkinchi marta kelsa yangi lid ochilmaydi: mavjud lidga "murojaat" qo'shiladi, birinchi manba saqlanadi.
 * - Rad etgan lid qayta murojaat qilsa — "Yangi" bosqichiga qaytadi (sotuvchi yana qo'ng'iroq qiladi).
 * - Bir raqam bo'yicha parallel so'rovlar navbat bilan bajariladi (advisory lock).
 */
export async function ingestLead(i: IngestInput): Promise<IngestResult> {
  const source = canonicalSource(i.source);
  const campaign = clean(i.campaign, 120);
  const ad = clean(i.ad, 120);
  const name = clean(i.name, 80) ?? 'Ismsiz';
  const note = clean(i.note, 600);
  const detail = clean(i.detail, 300);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7704, hashtext(${i.phone}))`);
    if (i.externalId) {
      const [x] = await tx.execute<{ id: number; full_name: string }>(sql`select id, full_name from leads where external_id = ${i.externalId}`);
      if (x) return { id: x.id, duplicate: true, reopened: false, name: x.full_name, studentName: null };
    }
    const [st] = await tx.execute<{ full_name: string }>(sql`
      select full_name from students where phone = ${i.phone} or parent_phone = ${i.phone} order by id desc limit 1`);
    const [old] = await tx.execute<{ id: number; full_name: string; stage: string; course_id: number | null; external_id: string | null }>(sql`
      select id, full_name, stage::text, course_id, external_id from leads where phone = ${i.phone} order by created_at desc limit 1 for update`);
    if (old) {
      const reopen = old.stage === 'rad_etdi';
      await tx.execute(sql`
        update leads set touches = touches + 1, last_touch_at = now(), updated_at = now(),
          course_id = coalesce(course_id, ${i.courseId ?? null}),
          external_id = coalesce(external_id, ${i.externalId ?? null}),
          referred_by_student_id = coalesce(referred_by_student_id, ${i.referredByStudentId ?? null})
          ${reopen ? sql`, stage = 'yangi', lost_reason = null, call_status = null, next_call_at = ${null}` : sql``}
        where id = ${old.id}`);
      await tx.execute(sql`
        insert into lead_touches (lead_id, source, campaign, ad, via, detail, created_by_id)
        values (${old.id}, ${source}, ${campaign}, ${ad}, ${i.via}, ${[detail, note].filter(Boolean).join('. ') || null}, ${i.createdById ?? null})`);
      await tx.execute(sql`
        insert into notes (entity_type, entity_id, kind, text, author_id)
        values ('lead', ${old.id}, 'izoh', ${`Qayta murojaat: ${source}${campaign ? `, ${campaign}` : ''}${ad ? ` (${ad})` : ''}${reopen ? '. Rad etgan edi — yana "Yangi" bosqichiga qaytdi' : ''}${note ? `. ${note}` : ''}`}, ${i.createdById ?? null})`);
      return { id: old.id, duplicate: true, reopened: reopen, name: old.full_name, studentName: st?.full_name ?? null };
    }
    let assigned = i.assignedToId ?? null;
    let branchId = i.branchId ?? null;
    if (!assigned && i.via !== 'qolda') {
      const sel = await nextSeller(tx, branchId);
      assigned = sel?.id ?? null;
      // Filiali noma'lum lid — biriktirilgan sotuvchining filialiga
      if (!branchId && sel?.branch_id) branchId = sel.branch_id;
    }
    const fullNote = [note, st ? `Diqqat: bu raqam o'quvchi ${st.full_name} ga tegishli` : null].filter(Boolean).join('. ') || null;
    const [row] = await tx.execute<{ id: number }>(sql`
      insert into leads (full_name, phone, source, campaign, ad, course_id, branch_id, note, external_id, created_by_id, assigned_to_id, referred_by_student_id, trial_date)
      values (${name}, ${i.phone}, ${source}, ${campaign}, ${ad}, ${i.courseId ?? null}, ${branchId}, ${fullNote}, ${i.externalId ?? null},
        ${i.createdById ?? null}, ${assigned}, ${i.referredByStudentId ?? null}, ${i.trialDate ?? null})
      returning id`);
    await tx.execute(sql`
      insert into lead_touches (lead_id, source, campaign, ad, via, detail, created_by_id)
      values (${row.id}, ${source}, ${campaign}, ${ad}, ${i.via}, ${detail}, ${i.createdById ?? null})`);
    return { id: row.id, duplicate: false, reopened: false, name, studentName: st?.full_name ?? null };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Avtomatik lid uchun sotuvchi: shu filialdagi faol sotuvchilardan eng kam ochiq lidi borini tanlaydi */
async function nextSeller(tx: Tx, branchId: number | null) {
  const s = await getSettings();
  if (!s.leadAutoAssign) return null;
  const [u] = await tx.execute<{ id: number; branch_id: number | null }>(sql`
    select u.id, u.branch_id from users u
    where u.active and u.role = 'sotuv' and (u.branch_id is null or ${branchId}::int is null or u.branch_id = ${branchId})
    order by (select count(*) from leads l where l.assigned_to_id = u.id and l.stage not in ('tolov_qildi','rad_etdi')), u.id
    limit 1`);
  return u ?? null;
}
