import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: 'ok' });
  } catch (e) {
    return NextResponse.json({ ok: false, db: (e as Error).message.slice(0, 120) }, { status: 500 });
  }
}
