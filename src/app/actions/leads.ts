'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { leads, notes, salesPlans, users, type LeadStage } from '@/db/schema';
import { and } from 'drizzle-orm';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { CALL_STATUSES, STAGE_INDEX } from '@/lib/constants';
import { assertBranch, assertStaffFor, resolveBranch } from '@/lib/branch';

export async function saveLead(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
    await assertBranch('lead', id);
    const v = {
      fullName: req(fd, 'fullName', 'Ism'),
      phone: normalizePhone(req(fd, 'phone', 'Telefon')),
      source: str(fd, 'source') || 'Instagram',
      courseId: int(fd, 'courseId'),
      assignedToId: int(fd, 'assignedToId') ?? (u.role === 'sotuv' ? u.id : null),
      trialDate: str(fd, 'trialDate'),
      note: str(fd, 'note'),
      updatedAt: new Date(),
    };
    const branchId = id ? (await db.select({ b: leads.branchId }).from(leads).where(eq(leads.id, id)))[0]?.b : await resolveBranch(null);
    await assertStaffFor(v.assignedToId, ['sotuv', 'admin', 'rahbar', 'marketing'], branchId);
    if (id) await db.update(leads).set(v).where(eq(leads.id, id));
    else await db.insert(leads).values({ ...v, branchId });
    return { message: id ? 'Lid yangilandi' : "Lid qo'shildi" };
  });
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
