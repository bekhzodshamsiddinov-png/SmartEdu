import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { leads, courses, users, notes, students, leadTouches } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { courseOptions, groupOptions, staffOptions } from '@/lib/options';
import { LeadsView } from './view';
import { getBranchScope } from '@/lib/branch';
import { salesProgress } from '@/lib/sales';
import { thisMonth, today } from '@/lib/dates';

export const metadata = { title: 'Lidlar' };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('leads');
  const assignee = alias(users, 'assignee');
  const referrer = alias(students, 'referrer');
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
        callStatus: leads.callStatus,
        nextCallAt: leads.nextCallAt,
        lostReason: leads.lostReason,
        note: leads.note,
        studentId: leads.studentId,
        campaign: leads.campaign,
        ad: leads.ad,
        touches: leads.touches,
        lastTouchAt: leads.lastTouchAt,
        referredById: leads.referredByStudentId,
        referredBy: referrer.fullName,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(courses, eq(courses.id, leads.courseId))
      .leftJoin(assignee, eq(assignee.id, leads.assignedToId))
      .leftJoin(referrer, eq(referrer.id, leads.referredByStudentId))
      .where(sql`(${leads.createdAt} > now() - interval '180 days' or ${leads.stage} not in ('tolov_qildi','rad_etdi')) ${scope.id ? sql`and (${leads.branchId} = ${scope.id} or ${leads.branchId} is null)` : sql``}`)
      .orderBy(desc(leads.updatedAt)),
    courseOptions(),
    staffOptions(['sotuv', 'admin', 'rahbar', 'marketing']),
    groupOptions(scope.id),
  ]);
  const month = thisMonth();
  const [plan, lostReasons] = await Promise.all([
    salesProgress(month, scope.id),
    db.execute<{ title: string }>(sql`select title from reasons where kind = 'lid' and active order by position, title`),
  ]);
  const pid = Number(sp.id);
  const has = pid && rows.some((r) => r.id === pid);
  const [history, touches] = has
    ? await Promise.all([
        db
          .select({ id: notes.id, kind: notes.kind, text: notes.text, createdAt: notes.createdAt, by: users.fullName })
          .from(notes)
          .leftJoin(users, eq(users.id, notes.authorId))
          .where(sql`${notes.entityType} = 'lead' and ${notes.entityId} = ${pid}`)
          .orderBy(desc(notes.createdAt)),
        db
          .select({ id: leadTouches.id, source: leadTouches.source, campaign: leadTouches.campaign, ad: leadTouches.ad, via: leadTouches.via, detail: leadTouches.detail, createdAt: leadTouches.createdAt, by: users.fullName })
          .from(leadTouches)
          .leftJoin(users, eq(users.id, leadTouches.createdById))
          .where(eq(leadTouches.leadId, pid))
          .orderBy(desc(leadTouches.createdAt)),
      ])
    : [[], []];
  const campaigns = [...new Set(rows.map((r) => r.campaign).filter((x): x is string => !!x))].slice(0, 50);
  return (
    <LeadsView
      rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), lastTouchAt: r.lastTouchAt.toISOString() }))}
      touches={touches.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      campaigns={campaigns}
      canReport={['rahbar', 'admin', 'marketing'].includes(user.role)}
      courses={copts}
      sales={sales}
      groups={gopts}
      selectedId={pid || null}
      history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
      openNew={sp.yangi === '1'}
      meId={user.id}
      plan={plan}
      month={month}
      isBoss={user.role === 'rahbar'}
      today={today()}
      lostReasons={lostReasons.map((r) => r.title)}
      stageFilter={sp.bosqich ?? ''}
      callsToday={sp.qongiroq === '1'}
    />
  );
}
