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
  return <SettingsView s={{ centerName: s.centerName, phone: s.phone, address: s.address, paymentDueDay: s.paymentDueDay, salaryDay: s.salaryDay, reservePercent: s.reservePercent }} counts={c} />;
}
