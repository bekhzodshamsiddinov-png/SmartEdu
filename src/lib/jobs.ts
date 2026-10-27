import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { today, addDays } from './dates';
import { getSettings } from './settings';
import { getBalances } from './finance';
import { enqueue, flushOutbox, moneyVar } from './messaging';
import { fmtDate } from './dates';

/** Bir kunda bir marta: kalitni atomar band qilgan jarayongina ishni bajaradi */
async function once(key: string) {
  const r = await db.execute(sql`insert into job_runs (key) values (${key}) on conflict do nothing returning key`);
  return r.length > 0;
}

/** Ketma-ket N marta kelmagan o'quvchilar uchun administratorga vazifa (takrorlanmaydi) */
export async function absentTasks() {
  const s = await getSettings();
  const n = s.absentTaskAfter;
  if (!n || n < 1) return;
  const rows = await db.execute<{ student_id: number; name: string; branch_id: number | null; last: string; grp: string }>(sql`
    select x.student_id, st.full_name name, st.branch_id, x.last::text, x.grp from (
      select a.student_id, max(a.date) last, max(g.name) grp,
        count(*) filter (where a.status = 'kelmadi') bad, count(*) total
      from (select a.*, row_number() over (partition by a.student_id order by a.date desc) rn from attendance a) a
      join groups g on g.id = a.group_id
      where a.rn <= ${n}
      group by a.student_id
    ) x join students st on st.id = x.student_id
    where x.total = ${n} and x.bad = ${n} and st.status in ('faol','xavf')`);
  for (const r of rows) {
    const [who] = await db.execute<{ id: number }>(sql`
      select id from users where active and role in ('admin','rahbar')
      order by (role = 'admin' and branch_id is not distinct from ${r.branch_id}) desc, (role = 'admin') desc, id limit 1`);
    if (!who) continue;
    await db.execute(sql`
      insert into tasks (title, description, assignee_id, due_date, priority, auto_key, entity_type, entity_id)
      values (${`${r.name}: ketma-ket ${n} marta darsga kelmadi`}, ${`Guruh: ${r.grp}. Oxirgi dars: ${fmtDate(r.last)}. Ota-onasi bilan bog'lanib, sababini aniqlang.`},
        ${who.id}, ${today()}, 'yuqori', ${`absent:${r.student_id}:${r.last}`}, 'student', ${r.student_id})
      on conflict do nothing`);
  }
}

/** Kunlik avtomatik ishlar: vazifalar, tug'ilgan kun, qarz va birinchi dars eslatmalari, xabarlarni yuborish */
export async function runDaily() {
  const t = today();
  if (!(await once(`daily:${t}`))) {
    await flushOutbox(10);
    return;
  }
  const s = await getSettings();
  await absentTasks();
  // Tug'ilgan kunlar
  const bd = await db.execute<{ id: number }>(sql`
    select id from students where status in ('faol','xavf') and birth_date is not null
      and to_char(birth_date, 'MM-DD') = ${t.slice(5)}`);
  for (const r of bd) await enqueue('tugilgan_kun', r.id, {}, `bday:${r.id}:${t.slice(0, 4)}`);
  // Birinchi dars ertaga
  const tomorrow = addDays(t, 1);
  const first = await db.execute<{ id: number; student_id: number; grp: string; start_time: string }>(sql`
    select e.id, e.student_id, g.name grp, g.start_time from enrollments e join groups g on g.id = e.group_id
    where e.active and e.end_date is null and e.start_date = ${tomorrow}`);
  for (const r of first) await enqueue('birinchi_dars', r.student_id, { guruh: r.grp, vaqt: r.start_time }, `first:${r.id}`);
  // Qarz eslatmasi: to'lov muddatidan keyingi kun, oyiga bir marta
  if (Number(t.slice(8)) === Math.min(28, s.paymentDueDay + 1)) {
    const b = await getBalances(t);
    const act = await db.execute<{ id: number }>(sql`select id from students where status in ('faol','xavf')`);
    for (const r of act) {
      const debt = -(b.get(r.id)?.balance ?? 0);
      if (debt >= s.debtNoticeMin) await enqueue('qarz', r.id, { qarz: moneyVar(debt) }, `debt:${r.id}:${t.slice(0, 7)}`);
    }
  }
  // Eski kunlik kalitlarni tozalash
  await db.execute(sql`delete from job_runs where ran_at < now() - interval '40 days'`);
  await flushOutbox(30);
}
