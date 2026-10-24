import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { transactions, reconciliations, users } from '@/db/schema';
import { requireSection } from '@/lib/auth';
import { CATEGORY_TO_RECON } from '@/lib/finance';
import { getSettings } from '@/lib/settings';
import { monthEnd, monthStart, thisMonth } from '@/lib/dates';
import { expensesByCategory, incomeExpense, monthlySeries, revenueByCourse } from '@/lib/stats';
import { FinanceView } from './view';

export const metadata = { title: 'Moliya' };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireSection('finance');
  const month = /^\d{4}-\d{2}$/.test(sp.oy ?? '') ? sp.oy : thisMonth();
  const from = monthStart(month);
  const to = monthEnd(month);
  const [tx, ie, rec, byCourse, byCat, series, s, payMethods] = await Promise.all([
    db
      .select({ id: transactions.id, type: transactions.type, category: transactions.category, amount: transactions.amount, date: transactions.date, method: transactions.method, counterparty: transactions.counterparty, document: transactions.document, note: transactions.note, by: users.fullName })
      .from(transactions)
      .leftJoin(users, eq(users.id, transactions.createdById))
      .where(sql`${transactions.date} between ${from} and ${to}`)
      .orderBy(desc(transactions.date), desc(transactions.id)),
    incomeExpense(from, to),
    db.select().from(reconciliations).where(eq(reconciliations.month, month)),
    revenueByCourse(from, to),
    expensesByCategory(from, to),
    monthlySeries(month, 6),
    getSettings(),
    db.execute<{ method: string; s: string }>(sql`select method::text, sum(amount) s from payments where paid_at between ${from} and ${to} group by 1`),
  ]);
  const system: Record<string, number> = { kirim: ie.income, oylik: 0, ijara: 0, kommunal: 0, marketing: 0, soliq: 0, boshqa: 0 };
  for (const c of byCat) system[CATEGORY_TO_RECON[c.category] ?? 'boshqa'] += Number(c.s);
  return (
    <FinanceView
      month={month}
      tx={tx}
      ie={ie}
      rec={rec[0] ? { bank: rec[0].bank, tax: rec[0].tax, note: rec[0].note } : null}
      system={system}
      byCourse={byCourse.map((c) => ({ name: c.name, color: c.color, s: Number(c.s) }))}
      byCat={byCat.map((c) => ({ category: c.category, s: Number(c.s) }))}
      series={series}
      reservePercent={s.reservePercent}
      payMethods={Object.fromEntries(payMethods.map((p) => [p.method, Number(p.s)]))}
      tab={(['jurnal', 'solishtirma', 'tahlil'].includes(sp.tab) ? sp.tab : 'jurnal') as 'jurnal' | 'solishtirma' | 'tahlil'}
      openNew={sp.yangi === '1'}
      isBoss={user.role === 'rahbar'}
    />
  );
}
