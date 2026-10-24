import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { payments, students, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { getBalances } from '@/lib/finance';
import { getSettings } from '@/lib/settings';
import { monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { PaymentsView } from './view';
import { getBranchScope } from '@/lib/branch';

export const metadata = { title: "To'lovlar" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('payments');
  const scope = await getBranchScope();
  const B = scope.id;
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const [list, all, balances, s, lastPay, enr] = await Promise.all([
    db
      .select({ id: payments.id, amount: payments.amount, method: payments.method, paidAt: payments.paidAt, forMonth: payments.forMonth, note: payments.note, studentId: students.id, student: students.fullName, by: users.fullName })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .leftJoin(users, eq(users.id, payments.receivedById))
      .where(sql`${payments.paidAt} between ${monthStart(month)} and ${monthEnd(month)} ${B ? sql`and ${payments.branchId} = ${B}` : sql``}`)
      .orderBy(desc(payments.paidAt), desc(payments.id)),
    db.select({ id: students.id, name: students.fullName, phone: students.phone, parentPhone: students.parentPhone, parentName: students.parentName, status: students.status }).from(students).where(sql`${students.status} in ('faol','xavf','muzlatilgan') ${B ? sql`and ${students.branchId} = ${B}` : sql``}`).orderBy(students.fullName),
    getBalances(),
    getSettings(),
    db.execute<{ student_id: number; d: string }>(sql`select student_id, max(paid_at)::text d from payments group by 1`),
    db.execute<{ id: number; student_id: number; label: string }>(sql`select e.id, e.student_id, g.name || ' (' || c.name || ')' label from enrollments e join groups g on g.id = e.group_id join courses c on c.id = g.course_id where e.active and e.end_date is null`),
  ]);
  const lp = new Map(lastPay.map((r) => [r.student_id, r.d]));
  const em = new Map<number, { id: number; label: string }[]>();
  for (const e of enr) em.set(e.student_id, [...(em.get(e.student_id) ?? []), { id: e.id, label: e.label }]);
  const opts = all.map((x) => {
    const b = balances.get(x.id);
    return { id: x.id, name: x.name, phone: x.phone, debt: b && b.balance < 0 ? -b.balance : 0, fee: b?.monthlyFee ?? 0, enrollments: em.get(x.id) ?? [] };
  });
  const debtors = all
    .filter((x) => x.status !== 'muzlatilgan' || (balances.get(x.id)?.balance ?? 0) < 0)
    .map((x) => {
      const b = balances.get(x.id);
      return { id: x.id, name: x.name, phone: x.parentPhone || x.phone, parentName: x.parentName, debt: b ? -b.balance : 0, months: b?.overdueMonths ?? 0, fee: b?.monthlyFee ?? 0, lastPaid: lp.get(x.id) ?? null };
    })
    .filter((d) => d.debt > 0)
    .sort((a, b) => b.debt - a.debt);
  return (
    <PaymentsView
      month={month}
      list={list}
      students={opts}
      debtors={debtors}
      dueDay={s.paymentDueDay}
      tab={sp.tab === 'qarzdorlar' ? 'qarzdorlar' : 'tolovlar'}
      openNew={sp.yangi === '1'}
      isBoss={user.role === 'rahbar'}
    />
  );
}
