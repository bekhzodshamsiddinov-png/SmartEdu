// Ma'lumotlar bazasi jadvallarini yaratadi / yangilaydi (build oldidan ishga tushadi)
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL topilmadi — migratsiya o\'tkazib yuborildi.');
  process.exit(0);
}
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require', onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  console.log('[migrate] Baza tayyor.');
} catch (e) {
  console.error('[migrate] Xato:', e);
  process.exit(1);
} finally {
  await sql.end();
}
