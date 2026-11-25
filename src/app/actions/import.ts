'use server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { assertSection } from '@/lib/auth';
import { run } from '@/lib/action';
import { DAY_CODES, today, addDays } from '@/lib/dates';
import { assertStaffFor, getBranchScope, lockedBranch, resolveBranch } from '@/lib/branch';
import { scheduleConflict } from '@/lib/schedule';
import { ensureMonthlyCharges } from '@/lib/billing';
import { audit } from '@/lib/security';
import { canonicalSource, clean } from '@/lib/leads-ingest';
import { LEAD_SOURCES } from '@/lib/constants';
import { cleanPhone, describe, guessLead, shortNote, type ParsedRow } from '@/lib/import-parse';

const MAX_ROWS = 400;

/** Brauzerdan kelgan qatorni qayta tekshirib, toza ko'rinishga keltiradi (ishonmaymiz) */
function sanitize(x: unknown): ParsedRow | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const s = (v: unknown, n: number) => clean(v, n);
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const name = s(r.name, 80);
  if (!name || name.length < 2) return null;
  const extra = Array.isArray(r.extra)
    ? (r.extra as unknown[]).slice(0, 20).flatMap((e) => {
        const o = e as Record<string, unknown>;
        const label = s(o?.label, 60);
        const value = s(o?.value, 400);
        return label && value ? [{ label, value }] : [];
      })
    : [];
  const row: ParsedRow = {
    line: Number.isInteger(r.line) ? Number(r.line) : 0,
    name,
    ownPhone: cleanPhone(r.ownPhone as string),
    fatherName: s(r.fatherName, 60),
    fatherPhone: cleanPhone(r.fatherPhone as string),
    motherName: s(r.motherName, 60),
    motherPhone: cleanPhone(r.motherPhone as string),
    direction: s(r.direction, 60),
    days: s(r.days, 60),
    time: s(r.time, 30),
    group: s(r.group, 40),
    startDate: date(r.startDate),
    comment: s(r.comment, 300),
    extra,
    phone: null,
  };
  row.phone = row.ownPhone ?? row.motherPhone ?? row.fatherPhone;
  return row;
}

function parsePayload(json: string) {
  if (typeof json !== 'string' || json.length > 600_000) throw new Error("Fayl juda katta. Varaqni bo'lib yuklang.");
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(json);
  } catch {
    throw new Error("Ma'lumot o'qilmadi.");
  }
  const raw = Array.isArray(p.rows) ? p.rows : [];
  if (!raw.length) throw new Error("Yuklash uchun qator tanlanmagan.");
  if (raw.length > MAX_ROWS) throw new Error(`Bir martada ${MAX_ROWS} tadan ko'p qator yuklab bo'lmaydi.`);
  const rows = raw.map(sanitize).filter((r): r is ParsedRow => !!r);
  const sheet = clean(p.sheet, 60) ?? 'Excel';
  return { p, rows, sheet };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

async function managers() {
  const s = await assertSection('students');
  if (!['rahbar', 'admin'].includes(s.role)) throw new Error("Excel'dan yuklashni rahbar yoki administrator bajaradi.");
  return s;
}

/**
 * Excel'dagi ro'yxatni lid sifatida yuklash.
 * Bir raqam + bir ism ikkinchi marta yuklanmaydi (qayta yuklash xavfsiz). Aka-uka bir raqamda bo'lsa — alohida lid.
 */
export async function importLeads(json: string) {
  return run(async () => {
    const u = await managers();
    await assertSection('leads');
    const { p, rows, sheet } = parsePayload(json);
    const source = canonicalSource(typeof p.source === 'string' ? p.source : '', "Eski o'quvchi");
    if (!LEAD_SOURCES.includes(source)) throw new Error('Manbani tanlang.');
    const courseMap = (p.courses && typeof p.courses === 'object' ? p.courses : {}) as Record<string, unknown>;
    const assignedToId = num(p.assignedToId);
    const locked = await lockedBranch();
    const branchId = await resolveBranch((await getBranchScope()).id ?? null);
    await assertStaffFor(assignedToId, ['sotuv', 'admin', 'rahbar', 'marketing'], branchId);
    const courseIds = new Set((await db.execute<{ id: number }>(sql`select id from courses`)).map((c) => c.id));

    let created = 0;
    let existed = 0;
    let noPhone = 0;
    for (const r of rows) {
      if (!r.phone) {
        noPhone++;
        continue;
      }
      const courseId = num(courseMap[r.direction ?? '']);
      const guess = guessLead(r.comment);
      const made = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(7704, hashtext(${r.phone}))`);
        const [same] = await tx.execute<{ id: number }>(sql`
          select id from leads where phone = ${r.phone} and lower(full_name) = lower(${r.name}) limit 1`);
        if (same) return false;
        const [sib] = await tx.execute<{ full_name: string; branch_id: number | null }>(sql`
          select full_name, branch_id from leads where phone = ${r.phone} order by id desc limit 1`);
        if (locked && sib?.branch_id && sib.branch_id !== locked) return false;
        const [st] = await tx.execute<{ full_name: string }>(sql`
          select full_name from students where phone = ${r.phone} or parent_phone = ${r.phone} order by id desc limit 1`);
        const warn = [sib && `Bu raqam ${sib.full_name} lidida ham bor`, st && `Bu raqam o'quvchi ${st.full_name} ga tegishli`].filter(Boolean).join('. ');
        const note = clean([shortNote(r), warn].filter(Boolean).join('. '), 600);
        const stage = guess.stage;
        const [row] = await tx.execute<{ id: number }>(sql`
          insert into leads (full_name, phone, source, course_id, branch_id, note, created_by_id, assigned_to_id, stage, max_stage, call_status, campaign)
          values (${r.name}, ${r.phone}, ${source}, ${courseId && courseIds.has(courseId) ? courseId : null}, ${branchId}, ${note}, ${u.id},
            ${assignedToId}, ${stage}::lead_stage, ${stage === 'boglanildi' ? 1 : 0}, ${guess.callStatus}, ${clean(sheet, 120)})
          returning id`);
        await tx.execute(sql`
          insert into lead_touches (lead_id, source, campaign, via, detail, created_by_id)
          values (${row.id}, ${source}, ${clean(sheet, 120)}, 'import', ${`Excel: «${sheet}», ${r.line}-qator`}, ${u.id})`);
        await tx.execute(sql`
          insert into notes (entity_type, entity_id, kind, text, author_id)
          values ('lead', ${row.id}, 'izoh', ${describe(r, sheet)}, ${u.id})`);
        return true;
      });
      if (made) created++;
      else existed++;
    }
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'import_lidlar', detail: `«${sheet}»: ${created} yangi, ${existed} bor edi, ${noPhone} raqamsiz` });
    const parts = [`${created} ta lid qo'shildi`, existed && `${existed} tasi bazada bor edi`, noPhone && `${noPhone} tasida telefon yo'q — o'tkazib yuborildi`].filter(Boolean);
    return { message: parts.join(', '), id: created };
  });
}

/**
 * Excel'dagi o'quvchilar ro'yxatini guruhga yuklash (kerak bo'lsa guruhni ham ochadi).
 * O'quvchi bazada bo'lsa (bir xil ism va raqam) — yangisi ochilmaydi, faqat guruhga qo'shiladi.
 */
export async function importStudents(json: string) {
  return run(async () => {
    const u = await managers();
    await assertSection('students');
    const { p, rows, sheet } = parsePayload(json);
    const start = typeof p.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) ? p.startDate : today();
    if (start < addDays(today(), -92) || start > addDays(today(), 31)) throw new Error("Guruhga qo'shilish sanasi 3 oydan eski yoki 1 oydan uzoq bo'lmasin.");

    // Guruh: mavjud yoki yangi
    let groupId = num(p.groupId);
    let groupName = '';
    if (groupId) {
      const [g] = await db.execute<{ id: number; name: string; branch_id: number | null; active: boolean }>(sql`select id, name, branch_id, active from groups where id = ${groupId}`);
      if (!g || !g.active) throw new Error('Guruh topilmadi yoki yopilgan.');
      const locked = await lockedBranch();
      if (locked && g.branch_id && g.branch_id !== locked) throw new Error("Bu guruh boshqa filialda.");
      groupName = g.name;
    } else {
      await assertSection('groups');
      const n = (p.newGroup ?? {}) as Record<string, unknown>;
      const name = clean(n.name, 60);
      if (!name) throw new Error('Yangi guruh nomini yozing.');
      const courseId = num(n.courseId);
      if (!courseId) throw new Error("Guruh yo'nalishini tanlang.");
      const [c] = await db.execute<{ id: number }>(sql`select id from courses where id = ${courseId} and active`);
      if (!c) throw new Error("Yo'nalish topilmadi.");
      const days = (Array.isArray(n.days) ? n.days : []).map(String).filter((d) => DAY_CODES.includes(d));
      if (!days.length) throw new Error('Dars kunlarini tanlang.');
      const dayStr = DAY_CODES.filter((d) => days.includes(d)).join(',');
      const st = String(n.startTime ?? '');
      const et = String(n.endTime ?? '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(st) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(et)) throw new Error("Vaqtni SS:DD ko'rinishida kiriting.");
      const teacherId = num(n.teacherId);
      const branchId = await resolveBranch((await getBranchScope()).id ?? null);
      await assertStaffFor(teacherId, ['oqituvchi', 'rahbar', 'admin'], branchId);
      const clash = await scheduleConflict({ id: null, days: dayStr, startTime: st, endTime: et, room: null, teacherId, branchId });
      if (clash) throw new Error(clash);
      const [g] = await db.execute<{ id: number }>(sql`
        insert into groups (name, course_id, branch_id, teacher_id, days, start_time, end_time, capacity, billing, start_date)
        values (${name}, ${courseId}, ${branchId}, ${teacherId}, ${dayStr}, ${st}, ${et}, ${Math.max(14, rows.length)}, 'oylik', ${start})
        returning id`);
      groupId = g.id;
      groupName = name;
    }

    const [info] = await db.execute<{ branch_id: number | null; price: number }>(sql`
      select g.branch_id, c.monthly_price price from groups g join courses c on c.id = g.course_id where g.id = ${groupId}`);
    // Joriy oy to'lovi eski tizimda olingan bo'lsa — shu oy uchun qarz yozilmaydi (0 so'mlik belgi)
    const skipFirst = p.skipFirstMonth !== false;
    let made = 0;
    let found = 0;
    let enrolled = 0;
    for (const r of rows) {
      const parentIsMother = !!r.motherPhone || !r.fatherPhone;
      const parentName = parentIsMother ? r.motherName : r.fatherName;
      const parentPhone = parentIsMother ? r.motherPhone : r.fatherPhone;
      await db.transaction(async (tx) => {
        const phones = [r.ownPhone, r.motherPhone, r.fatherPhone].filter(Boolean) as string[];
        const [old] = phones.length
          ? await tx.execute<{ id: number; branch_id: number | null }>(sql`
              select id, branch_id from students
              where lower(full_name) = lower(${r.name})
                and (phone in (${sql.join(phones.map((x) => sql`${x}`), sql`, `)}) or parent_phone in (${sql.join(phones.map((x) => sql`${x}`), sql`, `)}))
              order by id limit 1`)
          : await tx.execute<{ id: number; branch_id: number | null }>(sql`select id, branch_id from students where lower(full_name) = lower(${r.name}) and phone is null and parent_phone is null order by id limit 1`);
        let id = old?.id;
        if (id) {
          found++;
          await tx.execute(sql`update students set status = 'faol', left_at = null, branch_id = coalesce(${info.branch_id}, branch_id) where id = ${id} and status in ('ketgan', 'muzlatilgan')`);
        } else {
          const [s] = await tx.execute<{ id: number }>(sql`
            insert into students (full_name, phone, parent_name, parent_phone, joined_at, branch_id, source, note)
            values (${r.name}, ${r.ownPhone}, ${parentName}, ${parentPhone}, ${r.startDate && r.startDate <= today() ? r.startDate : start}, ${info.branch_id},
              ${"Excel ro'yxati"}, ${clean(shortNote(r), 400)})
            returning id`);
          id = s.id;
          made++;
          await tx.execute(sql`insert into notes (entity_type, entity_id, kind, text, author_id) values ('student', ${id}, 'izoh', ${describe(r, sheet)}, ${u.id})`);
        }
        const [inGroup] = await tx.execute(sql`select 1 from enrollments where student_id = ${id} and group_id = ${groupId} and end_date is null`);
        if (!inGroup) {
          const [e] = await tx.execute<{ id: number }>(sql`insert into enrollments (student_id, group_id, monthly_fee, start_date) values (${id}, ${groupId}, ${info.price}, ${start}) returning id`);
          if (skipFirst)
            await tx.execute(sql`
              insert into charges (student_id, enrollment_id, group_id, kind, amount, date, month, note)
              values (${id}, ${e.id}, ${groupId}, 'oylik', 0, ${start.slice(0, 7) + '-01'}, ${start.slice(0, 7)}, ${"Bu oy to'lovi eski ro'yxat bo'yicha (Excel'dan yuklandi)"})
              on conflict do nothing`);
          enrolled++;
        }
      });
    }
    await ensureMonthlyCharges(true);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'import_oquvchilar', detail: `«${sheet}» → ${groupName}: ${made} yangi, ${found} bor edi, ${enrolled} guruhga` });
    const parts = [`«${groupName}» guruhiga ${enrolled} ta o'quvchi qo'shildi`, made && `${made} tasi yangi ochildi`, found && `${found} tasi bazada bor edi`].filter(Boolean);
    return { message: parts.join(', '), id: groupId! };
  });
}
