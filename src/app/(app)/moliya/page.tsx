import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { transactions, reconciliations, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { CATEGORY_TO_RECON } from '@/lib/finance';
import { getSettings } from '@/lib/settings';
import { monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { expensesByCategory, incomeExpense, monthlySeries, revenueByCourse } from '@/lib/stats';
import { FinanceView } from './view';
import { allBranches, getBranchScope } from '@/lib/branch';
import { cashboxBalances } from '@/lib/cashbox';
import { payroll } from '@/lib/payroll';

export const metadata = { title: 'Moliya' };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('finance');
  const scope = await getBranchScope();
  const B = scope.id;
  const branches = (await allBranches()).filter((b) => b.active);
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const from = monthStart(month);
  const to = monthEnd(month);
  const tab = (['jurnal', 'solishtirma', 'tahlil', 'kassalar', 'oylik'].includes(sp.tab) ? sp.tab : 'jurnal') as 'jurnal' | 'solishtirma' | 'tahlil' | 'kassalar' | 'oylik';
  const boxes = (await cashboxBalances()).filter((b) => !user.branchId || !b.branchId || b.branchId === user.branchId);
  const [transfers, staffList, pay] = await Promise.all([
    tab === 'kassalar'
      ? db.execute<{ id: number; from_id: number; to_id: number; from: string; to: string; method: string; amount: number; status: string; note: string | null; by: string | null; created_by_id: number | null; at: string }>(sql`
          select t.id, t.from_id, t.to_id, f.name "from", c.name "to", t.method, t.amount, t.status, t.note, u.full_name by, t.created_by_id, (t.created_at at time zone 'Asia/Tashkent')::date::text at
          from cash_transfers t join cashboxes f on f.id = t.from_id join cashboxes c on c.id = t.to_id left join users u on u.id = t.created_by_id
          ${user.branchId ? sql`where (f.branch_id is null or f.branch_id = ${user.branchId}) and (c.branch_id is null or c.branch_id = ${user.branchId})` : sql``}
          order by (t.status = 'kutilmoqda') desc, t.id desc limit 50`)
      : Promise.resolve([]),
    tab === 'kassalar' ? db.select({ id: users.id, name: users.fullName }).from(users).where(user.branchId ? sql`${users.active} and (${users.branchId} is null or ${users.branchId} = ${user.branchId})` : eq(users.active, true)).orderBy(users.fullName) : Promise.resolve([]),
    tab === 'oylik' ? payroll(month, B) : Promise.resolve([]),
  ]);
  const [tx, ie, rec, byCourse, byCat, series, s, payMethods] = await Promise.all([
    db
      .select({ id: transactions.id, branchId: transactions.branchId, cashboxId: transactions.cashboxId, type: transactions.type, category: transactions.category, amount: transactions.amount, date: transactions.date, method: transactions.method, counterparty: transactions.counterparty, document: transactions.document, note: transactions.note, by: users.fullName })
      .from(transactions)
      .leftJoin(users, eq(users.id, transactions.createdById))
      .where(sql`${transactions.date} between ${from} and ${to} ${B ? sql`and ${transactions.branchId} = ${B}` : sql``}`)
      .orderBy(desc(transactions.date), desc(transactions.id)),
    incomeExpense(from, to, B),
    db.select().from(reconciliations).where(eq(reconciliations.month, month)),
    revenueByCourse(from, to, B),
    expensesByCategory(from, to, B),
    monthlySeries(month, 6, B),
    getSettings(),
    db.execute<{ method: string; s: string }>(sql`select p.method::text, sum(p.amount) s from payments p where p.cancelled_at is null and p.paid_at between ${from} and ${to} ${B ? sql`and p.branch_id = ${B}` : sql``} group by 1`),
  ]);
  // Filialga biriktirilgan xodim butun kompaniya raqamlarini ko'rmaydi
  const locked = !!user.branchId;
  const [ieAll, catAll] = B && !locked ? await Promise.all([incomeExpense(from, to), expensesByCategory(from, to)]) : [ie, byCat];
  const system: Record<string, number> = { kirim: ieAll.income, oylik: 0, ijara: 0, kommunal: 0, marketing: 0, soliq: 0, boshqa: 0 };
  for (const c of catAll) system[CATEGORY_TO_RECON[c.category] ?? 'boshqa'] += Number(c.s);
  return (
    <FinanceView
      month={month}
      tx={tx}
      ie={ie}
      rec={!locked && rec[0] ? { bank: rec[0].bank, tax: rec[0].tax, note: rec[0].note } : null}
      canReconcile={!locked}
      system={system}
      byCourse={byCourse.map((c) => ({ name: c.name, color: c.color, s: Number(c.s) }))}
      byCat={byCat.map((c) => ({ category: c.category, s: Number(c.s) }))}
      series={series}
      reservePercent={s.reservePercent}
      payMethods={Object.fromEntries(payMethods.map((p) => [p.method, Number(p.s)]))}
      tab={tab}
      boxes={boxes}
      transfers={[...transfers].map((t) => ({ id: t.id, fromId: t.from_id, toId: t.to_id, from: t.from, to: t.to, method: t.method, amount: t.amount, status: t.status, note: t.note, by: t.by, createdById: t.created_by_id, at: t.at }))}
      staff={staffList}
      payrollRows={pay}
      salaryDay={s.salaryDay}
      me={{ id: user.id, role: user.role }}
      openNew={sp.yangi === '1'}
      isBoss={user.role === 'rahbar'}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      currentBranch={B}
    />
  );
}
