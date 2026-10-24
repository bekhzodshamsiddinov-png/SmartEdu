// Faqat sinov uchun: lokal bazani namunaviy ma'lumot bilan to'ldiradi
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres@localhost:5433/smartedu');
const tz = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
const today = tz(new Date());
const addDays = (s, n) => { const d = s instanceof Date ? new Date(s) : new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

await sql`truncate branches, lesson_progress, course_orders, promo_codes, learners, course_lessons, course_modules, online_courses, staff_reports, tasks, graduates, results, grades, notes, leads, reconciliations, transactions, payments, attendance, lessons, enrollments, students, groups, courses, users, settings restart identity cascade`;
const hash = await bcrypt.hash('123456', 10);
await sql`insert into settings (id, center_name) values (1, 'United IT Clubs')`;
const [br1] = await sql`insert into branches (name, address) values ('Davlatobod filiali', 'Davlatobod tumani') returning id`;
const [br2] = await sql`insert into branches (name, address) values ('Namangan shahar filiali', 'Namangan shahri') returning id`;
const [boss] = await sql`insert into users (full_name, phone, password_hash, role, position) values ('Bekhzod Shamsiddinov', '998901234567', ${hash}, 'rahbar', 'Asoschi, rahbar') returning id`;
const staff = await sql`insert into users ${sql([
  { full_name: 'Dilnoza Rahimova', phone: '998901111111', password_hash: hash, role: 'admin', base_salary: 3500000, branch_id: br1.id },
  { full_name: 'Sardor Tursunov', phone: '998902222222', password_hash: hash, role: 'oqituvchi', base_salary: 5000000, branch_id: null },
  { full_name: 'Malika Yusupova', phone: '998903333333', password_hash: hash, role: 'oqituvchi', base_salary: 4500000, branch_id: null },
  { full_name: 'Jasur Qodirov', phone: '998904444444', password_hash: hash, role: 'sotuv', base_salary: 2500000, branch_id: null },
  { full_name: 'Nodira Karimova', phone: '998905555555', password_hash: hash, role: 'bugalter', base_salary: 3000000, branch_id: null },
])} returning id, role`;
const [admin, t1, t2, sales, buh] = staff.map((s) => s.id);
const courses = await sql`insert into courses ${sql([
  { name: 'Kompyuter savodxonligi', monthly_price: 300000, duration_months: 3, color: '#3D6FD1' },
  { name: "Sun'iy intellekt (AI)", monthly_price: 450000, duration_months: 3, color: '#008A70' },
  { name: 'YouTube blogging', monthly_price: 400000, duration_months: 2, color: '#C2862A' },
  { name: 'Fullstack AI dasturlash', monthly_price: 700000, duration_months: 6, color: '#7A5BC7' },
])} returning id`;
const groups = await sql`insert into groups ${sql([
  { name: 'KS-5', course_id: courses[0].id, teacher_id: t2, days: 'Du,Chor,Ju', start_time: '09:00', end_time: '11:00', room: '1', capacity: 15, start_date: addDays(today, -80), branch_id: br1.id },
  { name: 'AI-3', course_id: courses[1].id, teacher_id: t1, days: 'Du,Chor,Ju', start_time: '14:00', end_time: '16:00', room: '2', capacity: 12, start_date: addDays(today, -60), branch_id: br1.id },
  { name: 'AI-4', course_id: courses[1].id, teacher_id: t1, days: 'Se,Pa,Sha', start_time: '16:00', end_time: '18:00', room: '2', capacity: 12, start_date: addDays(today, -20), branch_id: br1.id },
  { name: 'YT-2', course_id: courses[2].id, teacher_id: t2, days: 'Se,Pa,Sha', start_time: '10:00', end_time: '12:00', room: '1', capacity: 10, start_date: addDays(today, -40), branch_id: br2.id },
  { name: 'FS-1', course_id: courses[3].id, teacher_id: t1, days: 'Du,Se,Chor,Pa,Ju', start_time: '18:00', end_time: '20:00', room: '3', capacity: 10, start_date: addDays(today, -120), branch_id: br2.id },
])} returning id, course_id, start_date::text, days, branch_id`;
const first = ['Azizbek', 'Sevara', 'Jahongir', 'Madina', 'Otabek', 'Zarina', 'Bobur', 'Kamola', 'Sherzod', 'Nilufar', 'Doniyor', 'Gulnoza', 'Islom', 'Shahnoza', 'Ulugbek', 'Dildora', 'Javohir', 'Maftuna', 'Akmal', 'Lola', 'Sanjar', 'Feruza', 'Asadbek', 'Muslima', 'Abdulloh', 'Robiya', 'Temur', 'Oysha', 'Behruz', 'Mohinur'];
const last = ['Karimov', 'Aliyeva', 'Tursunov', 'Rashidova', 'Yuldashev', 'Ergasheva', 'Nazarov', 'Saidova', 'Ismoilov', 'Hamidova'];
const price = Object.fromEntries((await sql`select id, monthly_price from courses`).map((c) => [c.id, c.monthly_price]));
let n = 0;
const studentIds = [];
for (const g of groups) {
  const count = 7 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const name = `${first[n % first.length]} ${last[(n * 7) % last.length]}${first[n % first.length].endsWith('a') && !last[(n * 7) % last.length].endsWith('a') ? 'a' : ''}`;
    n++;
    const start = addDays(g.start_date, Math.floor(Math.random() * 10));
    const [s] = await sql`insert into students (branch_id, full_name, phone, parent_name, parent_phone, joined_at, source, school) values (${g.branch_id}, ${name}, ${'99890' + String(1000000 + n * 7919).slice(0, 7)}, ${'Ota-onasi'}, ${'99893' + String(2000000 + n * 3571).slice(0, 7)}, ${start}, ${rnd(['Instagram', 'Tavsiya', 'Target', 'Ofisga keldi'])}, ${rnd(['12-maktab', '5-maktab', 'Litsey', '21-maktab'])}) returning id`;
    const [e] = await sql`insert into enrollments (student_id, group_id, monthly_fee, start_date) values (${s.id}, ${g.id}, ${price[g.course_id]}, ${start}) returning id`;
    studentIds.push({ id: s.id, g: g.id, e: e.id, fee: price[g.course_id], start });
  }
}
// payments: most paid, some debtors
for (const s of studentIds) {
  const months = Math.max(1, Math.round((Date.parse(today) - Date.parse(s.start)) / (30 * 86400000)) + 1);
  const paidMonths = Math.random() < 0.22 ? months - 1 : months;
  for (let m = 0; m < paidMonths; m++) {
    const d = addDays(s.start, m * 30 + Math.floor(Math.random() * 5));
    if (d > today) continue;
    await sql`insert into payments (student_id, enrollment_id, amount, method, for_month, paid_at, received_by_id) values (${s.id}, ${s.e}, ${s.fee}, ${rnd(['naqd', 'click', 'payme', 'karta', 'naqd'])}, ${d.slice(0, 7)}, ${d}, ${admin})`;
  }
}
// attendance last 21 days
const code = ['Ya', 'Du', 'Se', 'Chor', 'Pa', 'Ju', 'Sha'];
for (let k = 21; k >= 1; k--) {
  const d = addDays(today, -k);
  const wd = code[new Date(d + 'T00:00:00Z').getUTCDay()];
  for (const g of groups) {
    if (!g.days.split(',').includes(wd)) continue;
    const mem = studentIds.filter((s) => s.g === g.id && s.start <= d);
    if (!mem.length) continue;
    for (const s of mem) {
      const r = Math.random();
      await sql`insert into attendance (group_id, student_id, date, status, marked_by_id) values (${g.id}, ${s.id}, ${d}, ${r < 0.82 ? 'keldi' : r < 0.9 ? 'kechikdi' : 'kelmadi'}, ${admin}) on conflict do nothing`;
    }
    await sql`insert into lessons (group_id, date, topic, teacher_status) values (${g.id}, ${d}, ${rnd(['Prompt muhandisligi asoslari', 'ChatGPT bilan ishlash', 'Excel formulalar', 'Video montaj', 'React komponentlar', 'API bilan ishlash'])}, ${Math.random() < 0.08 ? 'kechikdi' : 'vaqtida'}) on conflict do nothing`;
  }
}
// two left, one graduated
const leftOnes = studentIds.slice(3, 5);
for (const [i, s] of leftOnes.entries()) {
  await sql`update students set status='ketgan', left_at=${addDays(today, -5 - i)}, left_reason=${i ? 'Moliyaviy qiyinchilik' : "Vaqt to'g'ri kelmadi"}, return_attempt=${"Ota-onasi bilan gaplashildi"}, return_result=${i ? "O'ylab ko'radi" : 'Rad etdi'} where id=${s.id}`;
  await sql`update enrollments set active=false, end_date=${addDays(today, -5 - i)} where id=${s.e}`;
}
const grad = studentIds[studentIds.length - 1];
await sql`update students set status='bitirgan', graduated_at=${addDays(today, -10)} where id=${grad.id}`;
await sql`update enrollments set active=false, end_date=${addDays(today, -10)} where id=${grad.e}`;
await sql`insert into graduates (student_id, workplace, position, monthly_income, last_contact_at, referrals) values (${grad.id}, 'IT Park Namangan', 'Junior dasturchi', 4000000, ${addDays(today, -10)}, 2)`;
await sql`insert into results (student_id, type, title, date) values (${studentIds[1].id}, 'Olimpiada', 'Viloyat IT olimpiadasi, 2-orin', ${addDays(today, -12)}), (${studentIds[8].id}, 'Birinchi zakaz', 'Logo dizayn zakazi', ${addDays(today, -3)})`;
// leads
const stages = ['yangi', 'yangi', 'boglanildi', 'sinov_yozildi', 'sinov_keldi', 'tolov_qildi', 'rad_etdi', 'boglanildi', 'yangi', 'sinov_yozildi'];
const idx = { yangi: 0, boglanildi: 1, sinov_yozildi: 2, sinov_keldi: 3, tolov_qildi: 4, rad_etdi: 1 };
for (let i = 0; i < 18; i++) {
  const st = stages[i % stages.length];
  await sql`insert into leads (branch_id, full_name, phone, source, course_id, stage, max_stage, assigned_to_id, trial_date, lost_reason, created_at, updated_at) values (${i % 3 ? br1.id : br2.id}, ${first[(i * 3) % first.length] + ' ' + last[i % last.length]}, ${'99897' + String(3000000 + i * 4111).slice(0, 7)}, ${rnd(['Instagram', 'Target', 'Telegram', 'Tavsiya', 'Ofisga keldi'])}, ${rnd(courses).id}, ${st}, ${idx[st]}, ${sales}, ${st === 'sinov_yozildi' ? addDays(today, 2) : null}, ${st === 'rad_etdi' ? 'Narx qimmat' : null}, ${new Date(Date.now() - i * 1.3 * 86400000)}, ${new Date(Date.now() - i * 86400000)})`;
}
// transactions 6 months
for (let m = 5; m >= 0; m--) {
  const base = new Date(Date.parse(today)); base.setUTCMonth(base.getUTCMonth() - m, 3);
  const d = base.toISOString().slice(0, 10);
  if (d > today) continue;
  await sql`insert into transactions ${sql([
    { type: 'chiqim', category: 'Ijara', amount: 3000000, date: d, method: 'bank', counterparty: 'Shahar ijara', document: 'Shartnoma No 3', branch_id: br2.id },
    { type: 'chiqim', category: 'Ijara', amount: 4000000, date: d, method: 'bank', counterparty: 'Ijara beruvchi', document: 'Shartnoma No 12', branch_id: br1.id },
    { type: 'chiqim', category: 'Kommunal va internet', amount: 900000, date: d, method: 'bank', counterparty: 'Uztelecom', document: null, branch_id: br1.id },
    { type: 'chiqim', category: 'Oylik', amount: 18500000, date: addDays(d, 7), method: 'bank', counterparty: 'Xodimlar', document: 'Vedomost', branch_id: br1.id },
    { type: 'chiqim', category: 'Marketing', amount: 1500000 + m * 100000, date: addDays(d, 2), method: 'karta', counterparty: 'Instagram target', document: null, branch_id: br1.id },
    { type: 'chiqim', category: 'Soliqlar', amount: 2200000, date: addDays(d, 10), method: 'bank', counterparty: 'Soliq', document: 'To\'lov topshiriqnomasi', branch_id: br1.id },
  ])}`;
}
await sql`insert into tasks (title, assignee_id, creator_id, due_date, priority) values ('Oktabr qarzdorlari bilan uchrashish', ${admin}, ${boss.id}, ${addDays(today, -1)}, 'yuqori'), ('AI-4 guruhi uchun dars rejasini yuklash', ${t1}, ${boss.id}, ${addDays(today, 3)}, 'orta'), ('Bitiruvchilar bazasini yig''ish', ${sales}, ${boss.id}, ${addDays(today, 5)}, 'orta')`;
await sql`insert into staff_reports (user_id, date, done, problems, plan) values (${admin}, ${addDays(today, -1)}, '5 ta dars o''tdi, 3 ta kelmaganga qo''ng''iroq qilindi, 4 ta to''lov qabul qilindi', 'KS-5 da proyektor ishlamayapti', 'Qarzdorlar bilan gaplashish')`;
console.log('Demo tayyor:', studentIds.length, "o'quvchi");
await sql.end();
