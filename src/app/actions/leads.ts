'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { leads, notes, salesPlans, students, users, type LeadStage } from '@/db/schema';
import { and } from 'drizzle-orm';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { CALL_STATUSES, LEAD_SOURCES, REFERRAL_SOURCES, STAGE_INDEX } from '@/lib/constants';
import { clean, ingestLead } from '@/lib/leads-ingest';
import { overLimit } from '@/lib/security';
import { assertBranch, assertStaffFor, getBranchScope, lockedBranch, resolveBranch } from '@/lib/branch';

export async function saveLead(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
    await assertBranch('lead', id);
    const source = str(fd, 'source');
    const prev = id ? (await db.select({ source: leads.source, phone: leads.phone, b: leads.branchId }).from(leads).where(eq(leads.id, id)))[0] : null;
    if (id && !prev) throw new Error('Lid topilmadi.');
    // Eski yozuvlardagi manba o'zgartirilmasa — qabul qilinadi
    if (!source || (!LEAD_SOURCES.includes(source) && source !== prev?.source)) throw new Error('Lid qayerdan kelganini (manbani) tanlang.');
    const phone = normalizePhone(req(fd, 'phone', 'Telefon'));
    if (!/^\d{9,15}$/.test(phone)) throw new Error("Telefon raqam noto'g'ri.");
    let referredBy = REFERRAL_SOURCES.includes(source) ? int(fd, 'referredByStudentId') : null;
    if (referredBy) {
      const [r] = await db.select({ id: students.id, b: students.branchId }).from(students).where(eq(students.id, referredBy));
      const locked = await lockedBranch();
      if (!r || (locked && r.b !== null && r.b !== locked)) referredBy = null;
    }
    const trialDate = str(fd, 'trialDate');
    if (trialDate && !/^\d{4}-\d{2}-\d{2}$/.test(trialDate)) throw new Error("Sana noto'g'ri.");
    const v = {
      fullName: req(fd, 'fullName', 'Ism').slice(0, 80),
      phone,
      source,
      campaign: clean(str(fd, 'campaign'), 120),
      ad: clean(str(fd, 'ad'), 120),
      referredByStudentId: referredBy,
      courseId: int(fd, 'courseId'),
      assignedToId: int(fd, 'assignedToId') ?? (u.role === 'sotuv' ? u.id : null),
      trialDate,
      note: str(fd, 'note')?.slice(0, 1000) ?? null,
      updatedAt: new Date(),
    };
    const branchId = id ? prev!.b : await resolveBranch(null);
    await assertStaffFor(v.assignedToId, ['sotuv', 'admin', 'rahbar', 'marketing'], branchId);
    if (id) {
      const locked = await lockedBranch();
      await db.transaction(async (tx) => {
        // Raqam o'zgarsa — o'sha raqam bo'yicha boshqa jarayonlar bilan navbat (ikki lid paydo bo'lmasin)
        if (phone !== prev!.phone) {
          await tx.execute(sql`select pg_advisory_xact_lock(7704, hashtext(${phone}))`);
          const [other] = await tx.execute(sql`select 1 from leads where phone = ${phone} and id <> ${id} limit 1`);
          if (other) throw new Error('Bu raqam boshqa lidda bor — yangi raqam kiriting yoki o\'sha lidni yuriting.');
        }
        // Filiali aniqlanmagan lidni filial xodimi tahrirlasa — lid shu filialga o'tadi
        await tx.update(leads).set(locked && !branchId ? { ...v, branchId: locked } : v).where(eq(leads.id, id));
      });
      return { message: 'Lid yangilandi', id };
    }
    const r = await ingestLead({
      name: v.fullName, phone, source, campaign: v.campaign, ad: v.ad, courseId: v.courseId, branchId, note: v.note,
      via: 'qolda', createdById: u.id, assignedToId: v.assignedToId, referredByStudentId: referredBy, trialDate, lockedBranch: await lockedBranch(),
    });
    if (r.duplicate) return { message: `Bu raqam bazada bor (${r.name}) — yangi murojaat sifatida qo'shildi${r.reopened ? ', lid qayta ochildi' : ''}`, id: r.id };
    // Yangi lid — oyna yopiladi (call-center ketma-ket kiritaveradi); takror bo'lsa — mavjud lid ochiladi
    return { message: r.studentName ? `Lid qo'shildi. Diqqat: raqam o'quvchi ${r.studentName} ga tegishli` : "Lid qo'shildi" };
  });
}

/** Lid qo'shishdan oldin: shu raqam bazada bormi (forma darhol ogohlantiradi) */
export async function checkLeadPhone(raw: string) {
  const u = await assertSection('leads');
  const phone = normalizePhone(String(raw ?? ''));
  if (!/^\d{9,15}$/.test(phone)) return null;
  if (await overLimit('lead-phone-check', String(u.id), 120, 60)) return null;
  const scope = await getBranchScope();
  const [l] = await db.execute<{ id: number; full_name: string; stage: string; source: string; branch_id: number | null }>(sql`
    select id, full_name, stage::text, source, branch_id from leads where phone = ${phone} order by created_at desc limit 1`);
  const [st] = await db.execute<{ full_name: string }>(sql`
    select full_name from students where (phone = ${phone} or parent_phone = ${phone}) ${scope.id ? sql`and (branch_id = ${scope.id} or branch_id is null)` : sql``} limit 1`);
  // Boshqa filial lidining tafsiloti ko'rsatilmaydi — faqat "bor" degan belgi
  const visible = l && (!scope.id || l.branch_id === scope.id || l.branch_id === null);
  return {
    lead: l ? (visible ? { id: l.id, name: l.full_name, stage: l.stage, source: l.source } : { id: null, name: 'boshqa filialda', stage: '', source: '—' }) : null,
    student: st ? st.full_name : null,
  };
}

/** Tavsiya qiluvchini tanlash uchun o'quvchi/bitiruvchi qidiruvi */
export async function searchReferrers(q: string) {
  await assertSection('leads');
  const t = String(q ?? '').trim().slice(0, 40);
  if (t.length < 2) return [];
  const scope = await getBranchScope();
  const digits = t.replace(/\D/g, '');
  const rows = await db.execute<{ id: number; name: string; status: string }>(sql`
    select id, full_name name, status::text from students
    where (full_name ilike ${'%' + t.replace(/[%_\\]/g, '') + '%'} ${digits.length >= 4 ? sql`or phone like ${'%' + digits}` : sql``})
      ${scope.id ? sql`and branch_id = ${scope.id}` : sql``}
    order by (status = 'bitirgan') desc, full_name limit 8`);
  return [...rows];
}

export async function moveLead(id: number, stage: LeadStage, lostReason?: string) {
  return run(async () => {
    const u = await assertSection('leads');
    await assertBranch('lead', id);
    const idx = STAGE_INDEX[stage];
    if (!(stage in STAGE_INDEX)) throw new Error("Bosqich noto'g'ri.");
    if (stage === 'rad_etdi' && !lostReason?.trim()) throw new Error('Rad etish sababini yozing.');
    lostReason = lostReason?.trim().slice(0, 80);
    await db
      .update(leads)
      .set({
        stage,
        updatedAt: new Date(),
        lostReason: stage === 'rad_etdi' ? lostReason : null,
        maxStage: idx >= 0 ? sql`greatest(${leads.maxStage}, ${idx})` : undefined,
      })
      .where(eq(leads.id, id));
    await db.insert(notes).values({ entityType: 'lead', entityId: id, kind: 'izoh', text: `Bosqich: ${stage}${lostReason ? ` (${lostReason})` : ''}`, authorId: u.id });
    return { message: 'Bosqich yangilandi' };
  });
}

export async function deleteLead(id: number) {
  return run(async () => {
    const u = await assertSection('leads');
    if (!['rahbar', 'admin'].includes(u.role)) throw new Error("Lidni rahbar yoki administrator o'chiradi.");
    await assertBranch('lead', id);
    await db.delete(leads).where(eq(leads.id, id));
    return { message: "Lid o'chirildi" };
  });
}


/** Qo'ng'iroq natijasi: belgi + keyingi qo'ng'iroq sanasi, tarixga yoziladi */
export async function logLeadCall(id: number, fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
    await assertBranch('lead', id);
    const status = str(fd, 'callStatus');
    if (!status || !CALL_STATUSES.some((c) => c.key === status)) throw new Error("Qo'ng'iroq natijasini tanlang.");
    const next = str(fd, 'nextCallAt');
    if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) throw new Error("Sana noto'g'ri.");
    const text = str(fd, 'text')?.slice(0, 500);
    await db
      .update(leads)
      .set({ callStatus: status, nextCallAt: next || null, updatedAt: new Date(), maxStage: sql`greatest(${leads.maxStage}, 1)`, stage: sql`case when ${leads.stage} = 'yangi' then 'boglanildi'::lead_stage else ${leads.stage} end` })
      .where(eq(leads.id, id));
    await db.insert(notes).values({ entityType: 'lead', entityId: id, kind: 'qongiroq', text: `${CALL_STATUSES.find((c) => c.key === status)!.label}${next ? `, keyingi qo'ng'iroq: ${next}` : ''}${text ? `. ${text}` : ''}`, authorId: u.id });
    return { message: "Qo'ng'iroq qayd etildi" };
  });
}

/** Sotuvchi uchun oylik reja (nechta sotuv) — rahbar belgilaydi */
export async function saveSalesPlan(userId: number, month: string, fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
    if (u.role !== 'rahbar') throw new Error('Savdo rejasini rahbar belgilaydi.');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Oy noto'g'ri.");
    const target = int(fd, 'target');
    if (target === null || target < 0 || target > 1000) throw new Error("Reja 0 dan 1000 gacha bo'lsin.");
    const [s] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.active, true)));
    if (!s) throw new Error('Xodim topilmadi.');
    await db.insert(salesPlans).values({ userId, month, target }).onConflictDoUpdate({ target: [salesPlans.userId, salesPlans.month], set: { target } });
    return { message: 'Reja saqlandi' };
  });
}

/** Reklama xarajati (oy + kanal + kampaniya). Bir xil kalit qayta kiritilsa — yangilanadi */
export async function saveAdSpend(fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
    if (!['rahbar', 'marketing'].includes(u.role)) throw new Error('Reklama xarajatini rahbar yoki marketolog kiritadi.');
    const month = str(fd, 'month') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Oyni tanlang.');
    const source = str(fd, 'source');
    if (!source || !LEAD_SOURCES.includes(source)) throw new Error('Kanalni tanlang.');
    const amount = int(fd, 'amount');
    if (amount === null || amount < 0 || amount > 2_000_000_000) throw new Error("Summani to'g'ri kiriting.");
    const campaign = clean(str(fd, 'campaign'), 120) ?? '';
    const branchId = await lockedBranchOr(int(fd, 'branchId'));
    const note = clean(str(fd, 'note'), 200);
    await db.execute(sql`
      insert into ad_spend (month, source, campaign, branch_id, amount, note, created_by_id) values (${month}, ${source}, ${campaign}, ${branchId}, ${amount}, ${note}, ${u.id})
      on conflict (month, source, campaign, coalesce(branch_id, 0)) do update set amount = excluded.amount, note = excluded.note, created_by_id = excluded.created_by_id, updated_at = now()`);
    return { message: 'Xarajat saqlandi' };
  });
}

export async function deleteAdSpend(id: number) {
  return run(async () => {
    const u = await assertSection('leads');
    if (!['rahbar', 'marketing'].includes(u.role)) throw new Error('Reklama xarajatini rahbar yoki marketolog o\'chiradi.');
    const locked = await lockedBranch();
    await db.execute(sql`delete from ad_spend where id = ${id} ${locked ? sql`and branch_id = ${locked}` : sql``}`);
    return { message: "O'chirildi" };
  });
}

async function lockedBranchOr(v: number | null) {
  const locked = await lockedBranch();
  if (locked) return locked;
  if (!v) return null;
  const [b] = await db.execute(sql`select 1 from branches where id = ${v}`);
  return b ? v : null;
}
