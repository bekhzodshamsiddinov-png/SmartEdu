'use server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { leads, notes, type LeadStage } from '@/db/schema';
import { assertSection } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { STAGE_INDEX } from '@/lib/constants';

export async function saveLead(id: number | null, fd: FormData) {
  return run(async () => {
    const u = await assertSection('leads');
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
    if (id) await db.update(leads).set(v).where(eq(leads.id, id));
    else await db.insert(leads).values(v);
    return { message: id ? 'Lid yangilandi' : "Lid qo'shildi" };
  });
}

export async function moveLead(id: number, stage: LeadStage, lostReason?: string) {
  return run(async () => {
    const u = await assertSection('leads');
    const idx = STAGE_INDEX[stage];
    if (stage === 'rad_etdi' && !lostReason) throw new Error('Rad etish sababini yozing.');
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
    await db.delete(leads).where(eq(leads.id, id));
    return { message: "Lid o'chirildi" };
  });
}
