import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { AccountView } from './view';

export const metadata = { title: 'Mening hisobim' };

export default async function AccountPage() {
  const me = await requireUser();
  const [u] = await db.select({ enabled: users.totpEnabled, backup: users.totpBackup }).from(users).where(eq(users.id, me.id));
  const logins = await db.execute<{ id: number; at: string; ip: string | null; detail: string | null }>(sql`
    select id, to_char(created_at at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI') at, ip, detail
    from audit_log where actor_type = 'xodim' and actor_id = ${me.id} and action = 'Tizimga kirdi' order by id desc limit 10`);
  return (
    <AccountView
      name={me.fullName}
      phone={me.phone}
      twoFactor={!!u?.enabled}
      backupLeft={u?.backup ? (JSON.parse(u.backup) as string[]).length : 0}
      logins={[...logins]}
    />
  );
}
