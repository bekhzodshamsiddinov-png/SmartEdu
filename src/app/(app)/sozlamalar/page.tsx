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
  };
  const academy = { payCard: s.payCard, payCardHolder: s.payCardHolder, telegram: s.telegram, instagram: s.instagram, academyTagline: s.academyTagline };
  return <SettingsView integrations={integrations} academy={academy} branches={[...branches]} s={{ centerName: s.centerName, phone: s.phone, address: s.address, paymentDueDay: s.paymentDueDay, salaryDay: s.salaryDay, reservePercent: s.reservePercent }} counts={c} />;
}
