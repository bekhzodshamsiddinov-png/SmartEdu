import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://postgres@localhost:5433/smartedu';

function isLocal(u: string) {
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(u).hostname);
  } catch {
    return /@(localhost|127\.0\.0\.1)[:/]/.test(u);
  }
}

const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

const sql =
  globalForDb.__sql ??
  postgres(url, {
    max: process.env.NODE_ENV === 'production' ? 5 : 10,
    prepare: false,
    idle_timeout: 20,
    // Server sertifikati tekshiriladi (soxta "baza" bilan aloqa o'rnatib bo'lmaydi)
    ssl: isLocal(url) ? false : 'verify-full',
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
