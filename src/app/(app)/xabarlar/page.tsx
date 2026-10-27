import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { getBranchScope } from '@/lib/branch';
import { EVENTS, botConfigured, botInfo, smsConfigured } from '@/lib/messaging';
import { MessagesView } from './view';

export const metadata = { title: 'Xabarlar' };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('messages');
  const scope = await getBranchScope();
  const B = scope.id;
  const status = ['qolda', 'xato', 'yuborildi', 'navbatda', 'bekor'].includes(sp.holat ?? '') ? sp.holat! : '';
  const [rows, counts, tpls, linked, bot] = await Promise.all([
    db.execute<{ id: number; event: string; channel: string; to: string; body: string; status: string; error: string | null; created: string; student_id: number | null; student: string | null }>(sql`
      select o.id, o.event, o.channel, o."to", o.body, o.status, o.error, to_char(o.created_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') created, o.student_id, s.full_name student
      from outbox o left join students s on s.id = o.student_id
      where true ${B ? sql`and (o.branch_id = ${B} or o.branch_id is null)` : sql``} ${status ? sql`and o.status = ${status}` : sql``}
      order by o.id desc limit 200`),
    db.execute<{ status: string; c: number }>(sql`select status, count(*)::int c from outbox ${B ? sql`where (branch_id = ${B} or branch_id is null)` : sql``} group by 1`),
    db.execute<{ event: string; body: string; active: boolean }>(sql`select event, body, active from message_templates`),
    db.execute<{ c: number }>(sql`select count(*)::int c from students where telegram_chat_id is not null`),
    botInfo(),
  ]);
  return (
    <MessagesView
      rows={[...rows]}
      counts={Object.fromEntries(counts.map((c) => [c.status, c.c]))}
      status={status}
      events={EVENTS}
      templates={Object.fromEntries(tpls.map((t) => [t.event, { body: t.body, active: t.active }]))}
      channels={{ sms: smsConfigured(), bot: botConfigured(), botName: bot?.username ?? null, linked: linked[0]?.c ?? 0 }}
      isBoss={user.role === 'rahbar'}
    />
  );
}
