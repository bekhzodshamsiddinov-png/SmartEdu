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
  const [tx, ie, rec, byCourse, byCat, series, s, payMethods] = await Promise.all([
    db
      .select({ id: transactions.id, branchId: transactions.branchId, type: transactions.type, category: transactions.category, amount: transactions.amount, date: transactions.date, method: transactions.method, counterparty: transactions.counterparty, document: transactions.document, note: transactions.note, by: users.fullName })
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
    db.execute<{ method: string; s: string }>(sql`select p.method::text, sum(p.amount) s from payments p where p.paid_at between ${from} and ${to} ${B ? sql`and p.branch_id = ${B}` : sql``} group by 1`),
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
      tab={(['jurnal', 'solishtirma', 'tahlil'].includes(sp.tab) ? sp.tab : 'jurnal') as 'jurnal' | 'solishtirma' | 'tahlil'}
      openNew={sp.yangi === '1'}
      isBoss={user.role === 'rahbar'}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      currentBranch={B}
    />
  );
}
