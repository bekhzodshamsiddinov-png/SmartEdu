import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/security';

/** Excel formulaga aylanib qolmasin (CSV injection): =, +, -, @ bilan boshlangan qiymatlar oldiga ' qo'yiladi */
function cell(x: unknown) {
  let s = String(x);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Parol, 2FA va sessiya ma'lumotlari hech qachon eksport qilinmaydi */
const SECRET_COLUMNS = new Set(['password_hash', 'totp_secret', 'totp_backup', 'totp_last_step', 'session_version']);
function strip(rows: Record<string, unknown>[]) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_COLUMNS.has(k))));
}

const TABLES = ['settings', 'branches', 'users', 'courses', 'groups', 'students', 'enrollments', 'lessons', 'attendance', 'payments', 'transactions', 'reconciliations', 'leads', 'notes', 'grades', 'results', 'graduates', 'tasks', 'staff_reports', 'online_courses', 'course_modules', 'course_lessons', 'learners', 'promo_codes', 'course_orders', 'lesson_progress', 'payme_transactions', 'audit_log'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u || u.role !== 'rahbar') return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  const table = new URL(req.url).searchParams.get('table');
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  if (table) {
    if (!TABLES.includes(table) || table === 'users') return NextResponse.json({ error: 'Jadval topilmadi' }, { status: 404 });
    const rows = strip([...(await db.execute<Record<string, unknown>>(sql.raw(`select * from "${table}" order by 1`)))]);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Ma'lumot yuklab olindi", detail: `${table}.csv, ${rows.length} qator` });
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const csv = [cols, ...rows.map((r) => cols.map((c) => (r[c] instanceof Date ? (r[c] as Date).toISOString() : typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : (r[c] ?? ''))))]
      .map((l) => l.map(cell).join(','))
      .join('\n');
    return new NextResponse('﻿' + csv, { headers: { 'cache-control': 'no-store', 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${table}-${stamp}.csv"` } });
  }
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 1 };
  for (const t of TABLES) {
    const rows = await db.execute<Record<string, unknown>>(sql.raw(`select * from "${t}" order by 1`));
    out[t] = strip([...rows]);
  }
  await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Ma'lumot yuklab olindi", detail: "To'liq zaxira (JSON)" });
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { 'cache-control': 'no-store', 'content-type': 'application/json', 'content-disposition': `attachment; filename="smartedu-zaxira-${stamp}.json"` } });
}
