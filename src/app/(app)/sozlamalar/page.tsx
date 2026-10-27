import { DEFAULT_CONTRACT } from '@/lib/contract';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireSection } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { SettingsView } from './view';

export const metadata = { title: 'Sozlamalar' };

export default async function SettingsPage() {
  await requireSection('settings');
  const s = await getSettings();
  const [c] = await db.execute<Record<string, number>>(sql`select
    (select count(*) from students)::int students, (select count(*) from payments)::int payments, (select count(*) from attendance)::int attendance,
    (select count(*) from leads)::int leads, (select count(*) from transactions)::int transactions, (select count(*) from users)::int users`);
  const branches = await db.execute<{ id: number; name: string; address: string | null; phone: string | null; active: boolean; students: number; groups: number }>(sql`
    select b.id, b.name, b.address, b.phone, b.active,
      (select count(*) from students s where s.branch_id = b.id and s.status in ('faol','xavf'))::int students,
      (select count(*) from groups g where g.branch_id = b.id and g.active)::int groups
    from branches b order by b.id`);
  const integrations = {
    click: !!(process.env.CLICK_SERVICE_ID && process.env.CLICK_MERCHANT_ID && process.env.CLICK_SECRET_KEY),
    payme: !!(process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    bunny: !!process.env.BUNNY_TOKEN_KEY,
  };
  const academy = { payCard: s.payCard, payCardHolder: s.payCardHolder, telegram: s.telegram, instagram: s.instagram, academyTagline: s.academyTagline };
  const auditRows = await db.execute<{ id: number; at: string; actorName: string | null; actorType: string; action: string; detail: string | null; ip: string | null }>(sql`
    select id, to_char(created_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') at, actor_name "actorName", actor_type "actorType", action, detail, ip
    from audit_log order by id desc limit 80`);
  const reasonRows = await db.execute<{ id: number; kind: string; title: string; charges: boolean; active: boolean; used: number }>(sql`
    select r.id, r.kind, r.title, r.charges, r.active,
      ((select count(*) from attendance a where a.reason_id = r.id))::int used
    from reasons r order by r.kind, r.active desc, r.position, r.title`);
  return <SettingsView defaultContract={DEFAULT_CONTRACT} reasonRows={[...reasonRows]} auditRows={[...auditRows]} integrations={integrations} academy={academy} branches={[...branches]} s={{ centerName: s.centerName, phone: s.phone, address: s.address, paymentDueDay: s.paymentDueDay, salaryDay: s.salaryDay, reservePercent: s.reservePercent, billingDefault: s.billingDefault, chargeAbsent: s.chargeAbsent, prorateFirstMonth: s.prorateFirstMonth, coinsPerLesson: s.coinsPerLesson, coinsOnTimePay: s.coinsOnTimePay, debtNoticeMin: s.debtNoticeMin, absentTaskAfter: s.absentTaskAfter, contractTemplate: s.contractTemplate }} counts={c} />;
}
