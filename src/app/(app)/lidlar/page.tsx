import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { leads, courses, users, notes } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { courseOptions, groupOptions, staffOptions } from '@/lib/options';
import { LeadsView } from './view';
import { getBranchScope } from '@/lib/branch';

export const metadata = { title: 'Lidlar' };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('leads');
  const assignee = alias(users, 'assignee');
  const scope = await getBranchScope();
  const [rows, copts, sales, gopts] = await Promise.all([
    db
      .select({
        id: leads.id,
        fullName: leads.fullName,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
        courseId: leads.courseId,
        course: courses.name,
        color: courses.color,
        assignedToId: leads.assignedToId,
        assigned: assignee.fullName,
        trialDate: leads.trialDate,
        lostReason: leads.lostReason,
        note: leads.note,
        studentId: leads.studentId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(courses, eq(courses.id, leads.courseId))
      .leftJoin(assignee, eq(assignee.id, leads.assignedToId))
      .where(sql`(${leads.createdAt} > now() - interval '180 days' or ${leads.stage} not in ('tolov_qildi','rad_etdi')) ${scope.id ? sql`and ${leads.branchId} = ${scope.id}` : sql``}`)
      .orderBy(desc(leads.updatedAt)),
    courseOptions(),
    staffOptions(['sotuv', 'admin', 'rahbar', 'marketing']),
    groupOptions(scope.id),
  ]);
  const pid = Number(sp.id);
  const history = pid
    ? await db
        .select({ id: notes.id, kind: notes.kind, text: notes.text, createdAt: notes.createdAt, by: users.fullName })
        .from(notes)
        .leftJoin(users, eq(users.id, notes.authorId))
        .where(sql`${notes.entityType} = 'lead' and ${notes.entityId} = ${pid}`)
        .orderBy(desc(notes.createdAt))
    : [];
  return (
    <LeadsView
      rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))}
      courses={copts}
      sales={sales}
      groups={gopts}
      selectedId={pid || null}
      history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
      openNew={sp.yangi === '1'}
      meId={user.id}
    />
  );
}
