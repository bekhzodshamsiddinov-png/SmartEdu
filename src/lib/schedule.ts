import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/** Ikki vaqt oralig'i kesishadimi ('HH:MM' satrlari) */
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2;

/**
 * Yangi yoki tahrirlanayotgan guruh boshqa faol guruh bilan bir xonada yoki bir o'qituvchida
 * bir vaqtga to'g'ri kelsa — tushunarli xato matnini qaytaradi.
 */
export async function scheduleConflict(g: { id: number | null; days: string; startTime: string; endTime: string; room: string | null; teacherId: number | null; branchId: number | null | undefined }) {
  if (g.startTime >= g.endTime) return "Dars tugash vaqti boshlanishidan keyin bo'lishi kerak.";
  const days = g.days.split(',');
  const others = await db.execute<{ id: number; name: string; days: string; start_time: string; end_time: string; room: string | null; teacher_id: number | null; branch_id: number | null; teacher: string | null }>(sql`
    select g.id, g.name, g.days, g.start_time, g.end_time, g.room, g.teacher_id, g.branch_id, u.full_name teacher
    from groups g left join users u on u.id = g.teacher_id
    where g.active ${g.id ? sql`and g.id <> ${g.id}` : sql``}`);
  const room = g.room?.trim().toLowerCase() || null;
  for (const o of others) {
    const sameDay = o.days.split(',').some((d) => days.includes(d));
    if (!sameDay || !overlaps(g.startTime, g.endTime, o.start_time, o.end_time)) continue;
    const sameBranch = !g.branchId || !o.branch_id || g.branchId === o.branch_id;
    if (room && sameBranch && o.room?.trim().toLowerCase() === room)
      return `«${g.room}» xonasi bu vaqtda band: ${o.name} guruhi (${o.start_time}–${o.end_time}).`;
    if (g.teacherId && o.teacher_id === g.teacherId)
      return `${o.teacher ?? "O'qituvchi"} bu vaqtda ${o.name} guruhida dars o'tadi (${o.start_time}–${o.end_time}).`;
  }
  return null;
}
