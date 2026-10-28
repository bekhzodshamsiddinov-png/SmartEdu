import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { loadMeta } from '@/lib/meta';
import { courseOptions } from '@/lib/options';
import { IntegrationsView } from './view';

export const metadata = { title: 'Integratsiyalar' };

export default async function IntegrationsPage() {
  const user = await requireSection('settings');
  if (user.role !== 'rahbar') redirect('/?ruxsat=yoq');
  const { secret, info } = await loadMeta();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  const [recent, stats, branches, courses] = await Promise.all([
    db.execute<{ id: number; status: string; error: string | null; at: string; lead_id: number | null; name: string | null; source: string | null; campaign: string | null; attempts: number }>(sql`
      select m.id, m.status, m.error, to_char(m.received_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') at, m.lead_id, l.full_name name, l.source, l.campaign, m.attempts
      from meta_leads m left join leads l on l.id = m.lead_id order by m.id desc limit 25`),
    db.execute<{ today: number; week: number; failed: number }>(sql`
      select count(*) filter (where received_at > now() - interval '1 day')::int today, count(*) filter (where received_at > now() - interval '7 days')::int week,
        count(*) filter (where status = 'xato')::int failed from meta_leads`),
    db.execute<{ id: number; name: string }>(sql`select id, name from branches where active order by id`),
    courseOptions(),
  ]);
  return (
    <IntegrationsView
      webhookUrl={`${proto}://${host}/api/meta/webhook`}
      meta={{
        hasSecret: !!secret?.appSecret,
        connected: !!secret?.pageToken && !!info.pageId,
        appId: info.appId ?? null,
        verifyToken: info.verifyToken ?? null,
        pageName: info.pageName ?? null,
        igName: info.igName ?? null,
        subscribed: !!info.subscribed,
        forms: info.forms ?? [],
        pending: (secret?.pendingPages ?? []).map((p) => ({ id: p.id, name: p.name, ig: p.ig })),
        lastEventAt: info.lastEventAt ?? null,
        lastSyncAt: info.lastSyncAt ?? null,
        lastError: info.lastError ?? null,
        connectedAt: info.connectedAt ?? null,
      }}
      recent={[...recent]}
      stats={stats[0] ?? { today: 0, week: 0, failed: 0 }}
      branches={[...branches]}
      courses={courses}
    />
  );
}
