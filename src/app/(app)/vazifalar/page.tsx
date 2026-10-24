import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { staffOptions } from '@/lib/options';
import { TasksView } from './view';

export const metadata = { title: 'Vazifalar' };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('tasks');
  const creator = alias(users, 'creator');
  const boss = user.role === 'rahbar' || user.role === 'admin';
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, description: tasks.description, assigneeId: tasks.assigneeId, assignee: users.fullName, creatorId: tasks.creatorId, creator: creator.fullName, dueDate: tasks.dueDate, status: tasks.status, priority: tasks.priority, doneAt: tasks.doneAt, createdAt: tasks.createdAt })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .leftJoin(creator, eq(creator.id, tasks.creatorId))
    .where(boss ? sql`(${tasks.status} <> 'bajarildi' or ${tasks.doneAt} > now() - interval '30 days')` : sql`(${tasks.assigneeId} = ${user.id} or ${tasks.creatorId} = ${user.id}) and (${tasks.status} <> 'bajarildi' or ${tasks.doneAt} > now() - interval '30 days')`)
    .orderBy(desc(tasks.createdAt));
  const staff = boss ? await staffOptions() : [{ id: user.id, name: user.fullName, role: user.role }];
  return (
    <TasksView
      rows={rows.map((r) => ({ ...r, doneAt: r.doneAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))}
      staff={staff}
      meId={user.id}
      isBoss={user.role === 'rahbar'}
      canAssign={boss}
      openNew={sp.yangi === '1'}
    />
  );
}
