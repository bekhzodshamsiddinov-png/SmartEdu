// Ma'lumotlar bazasi jadvallarini yaratadi / yangilaydi (build oldidan ishga tushadi)
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Xavfsizlik: preview (sinov) build'lari asosiy bazaga migratsiya qila olmaydi.
// Faqat production build'da yoki lokal kompyuterda ishlaydi.
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production' && !process.env.ALLOW_PREVIEW_MIGRATE) {
  console.warn(`[migrate] ${process.env.VERCEL_ENV} build — migratsiya o'tkazib yuborildi (faqat production).`);
  process.exit(0);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL topilmadi — migratsiya o\'tkazib yuborildi.');
  process.exit(0);
}
const host = new URL(url).hostname;
const local = host === 'localhost' || host === '127.0.0.1';
const sql = postgres(url, { max: 1, ssl: local ? false : 'verify-full', onnotice: () => {} });
try {
  // Ikki build bir vaqtda migratsiya qilmasin
  await sql`set lock_timeout = '120s'`;
  await sql`select pg_advisory_lock(7311002)`;
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  console.log('[migrate] Baza tayyor.');
} catch (e) {
  console.error('[migrate] Xato:', e);
  process.exit(1);
} finally {
  await sql.end();
}
