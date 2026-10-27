import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';

/** Tizim sozlanganmi (kamida bitta xodim bormi). Server action emas — tashqaridan chaqirib bo'lmaydi. */
export async function hasAnyUser() {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(users).limit(1);
  return (r?.c ?? 0) > 0;
}
