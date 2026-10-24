import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

export const getSettings = cache(async () => {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return s ?? { id: 1, centerName: 'United IT Clubs', phone: null, address: null, paymentDueDay: 5, salaryDay: 10, reservePercent: 10, payCard: null, payCardHolder: null, telegram: null, instagram: null, academyTagline: null, updatedAt: null };
});
