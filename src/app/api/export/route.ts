import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth';

const TABLES = ['settings', 'branches', 'users', 'courses', 'groups', 'students', 'enrollments', 'lessons', 'attendance', 'payments', 'transactions', 'reconciliations', 'leads', 'notes', 'grades', 'results', 'graduates', 'tasks', 'staff_reports', 'online_courses', 'course_modules', 'course_lessons', 'learners', 'promo_codes', 'course_orders', 'lesson_progress'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u || u.role !== 'rahbar') return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  const table = new URL(req.url).searchParams.get('table');
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  if (table) {
    if (!TABLES.includes(table) || table === 'users') return NextResponse.json({ error: 'Jadval topilmadi' }, { status: 404 });
    const rows = await db.execute<Record<string, unknown>>(sql.raw(`select * from "${table}" order by 1`));
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const csv = [cols, ...rows.map((r) => cols.map((c) => (r[c] instanceof Date ? (r[c] as Date).toISOString() : typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : (r[c] ?? ''))))]
      .map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return new NextResponse('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${table}-${stamp}.csv"` } });
  }
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 1 };
  for (const t of TABLES) {
    const rows = await db.execute<Record<string, unknown>>(sql.raw(`select * from "${t}" order by 1`));
    out[t] = t === 'users' ? rows.map(({ password_hash, ...r }) => (void password_hash, r)) : rows;
  }
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="smartedu-zaxira-${stamp}.json"` } });
}
