'use server';
import { ilike, or, desc , isNull } from 'drizzle-orm';
import { db } from '@/db';
import { students, leads, groups } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { getBranchScope } from '@/lib/branch';
import { and, eq, sql } from 'drizzle-orm';

export type SearchHit = { kind: string; kindLabel: string; id: number; title: string; sub: string; href: string };

export async function globalSearch(q: string): Promise<SearchHit[]> {
  const u = await getCurrentUser();
  if (!u) return [];
  const qq = String(q ?? '').trim().slice(0, 60);
  if (qq.length < 2) return [];
  // LIKE maxsus belgilarini qochiramiz
  const term = `%${qq.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  const mine = u.role === 'oqituvchi' || u.role === 'support';
  const B = (await getBranchScope()).id;
  const digits = qq.replace(/\D/g, '');
  const out: SearchHit[] = [];
  if (can(u.role, 'students')) {
    const r = await db
      .select({ id: students.id, n: students.fullName, p: students.phone, pp: students.parentPhone })
      .from(students)
      .where(
        and(
          or(ilike(students.fullName, term), digits.length >= 3 ? ilike(students.phone, `%${digits}%`) : undefined, digits.length >= 3 ? ilike(students.parentPhone, `%${digits}%`) : undefined),
          B ? eq(students.branchId, B) : undefined,
          // O'qituvchi faqat o'z guruhidagi o'quvchilarni topadi
          mine
            ? sql`exists (select 1 from enrollments e join groups g on g.id = e.group_id where e.student_id = ${students.id} and e.active and e.end_date is null and (g.teacher_id = ${u.id} or g.support_id = ${u.id}))`
            : undefined,
        ),
      )
      .orderBy(desc(students.id))
      .limit(6);
    out.push(...r.map((s) => ({ kind: 's', kindLabel: "O'quvchi", id: s.id, title: s.n, sub: s.p || s.pp || '', href: `/oquvchilar?id=${s.id}` })));
  }
  if (can(u.role, 'leads')) {
    const r = await db
      .select({ id: leads.id, n: leads.fullName, p: leads.phone })
      .from(leads)
      .where(and(or(ilike(leads.fullName, term), digits.length >= 3 ? ilike(leads.phone, `%${digits}%`) : undefined), B ? or(eq(leads.branchId, B), isNull(leads.branchId)) : undefined))
      .orderBy(desc(leads.id))
      .limit(5);
    out.push(...r.map((s) => ({ kind: 'l', kindLabel: 'Lid', id: s.id, title: s.n, sub: s.p, href: `/lidlar?id=${s.id}` })));
  }
  if (can(u.role, 'groups')) {
    const r = await db.select({ id: groups.id, n: groups.name }).from(groups).where(and(ilike(groups.name, term), B ? eq(groups.branchId, B) : undefined)).limit(4);
    out.push(...r.map((s) => ({ kind: 'g', kindLabel: 'Guruh', id: s.id, title: s.n, sub: '', href: `/guruhlar?id=${s.id}` })));
  }
  return out;
}
