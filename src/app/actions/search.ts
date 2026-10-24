'use server';
import { ilike, or, desc } from 'drizzle-orm';
import { db } from '@/db';
import { students, leads, groups } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/roles';

export type SearchHit = { kind: string; kindLabel: string; id: number; title: string; sub: string; href: string };

export async function globalSearch(q: string): Promise<SearchHit[]> {
  const u = await getCurrentUser();
  if (!u) return [];
  const term = `%${q.trim()}%`;
  const digits = q.replace(/\D/g, '');
  const out: SearchHit[] = [];
  if (can(u.role, 'students')) {
    const r = await db
      .select({ id: students.id, n: students.fullName, p: students.phone, pp: students.parentPhone })
      .from(students)
      .where(or(ilike(students.fullName, term), digits.length >= 3 ? ilike(students.phone, `%${digits}%`) : undefined, digits.length >= 3 ? ilike(students.parentPhone, `%${digits}%`) : undefined))
      .orderBy(desc(students.id))
      .limit(6);
    out.push(...r.map((s) => ({ kind: 's', kindLabel: "O'quvchi", id: s.id, title: s.n, sub: s.p || s.pp || '', href: `/oquvchilar?id=${s.id}` })));
  }
  if (can(u.role, 'leads')) {
    const r = await db
      .select({ id: leads.id, n: leads.fullName, p: leads.phone })
      .from(leads)
      .where(or(ilike(leads.fullName, term), digits.length >= 3 ? ilike(leads.phone, `%${digits}%`) : undefined))
      .orderBy(desc(leads.id))
      .limit(5);
    out.push(...r.map((s) => ({ kind: 'l', kindLabel: 'Lid', id: s.id, title: s.n, sub: s.p, href: `/lidlar?id=${s.id}` })));
  }
  if (can(u.role, 'groups')) {
    const r = await db.select({ id: groups.id, n: groups.name }).from(groups).where(ilike(groups.name, term)).limit(4);
    out.push(...r.map((s) => ({ kind: 'g', kindLabel: 'Guruh', id: s.id, title: s.n, sub: '', href: `/guruhlar?id=${s.id}` })));
  }
  return out;
}
