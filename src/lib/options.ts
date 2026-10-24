import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { groups, courses, users } from '@/db/schema';
import type { GroupOpt } from '@/components/forms';

export async function groupOptions(): Promise<GroupOpt[]> {
  const r = await db
    .select({ id: groups.id, name: groups.name, course: courses.name, fee: courses.monthlyPrice })
    .from(groups)
    .innerJoin(courses, eq(courses.id, groups.courseId))
    .where(eq(groups.active, true))
    .orderBy(asc(groups.name));
  return r;
}

export async function courseOptions() {
  return db.select({ id: courses.id, name: courses.name, color: courses.color, price: courses.monthlyPrice }).from(courses).where(eq(courses.active, true)).orderBy(asc(courses.id));
}

export async function staffOptions(roles?: string[]) {
  const r = await db
    .select({ id: users.id, name: users.fullName, role: users.role })
    .from(users)
    .where(roles ? sql`${users.active} = true and ${users.role} in (${sql.join(roles.map((x) => sql`${x}`), sql`, `)})` : eq(users.active, true))
    .orderBy(asc(users.fullName));
  return r;
}
