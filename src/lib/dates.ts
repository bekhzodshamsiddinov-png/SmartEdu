const TZ = 'Asia/Tashkent';

export const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
export const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
export const WEEKDAYS = ['Ya', 'Du', 'Se', 'Chor', 'Pa', 'Ju', 'Sha'];
export const WEEKDAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** Bugungi sana (Toshkent vaqti) YYYY-MM-DD */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function thisMonth(): string {
  return today().slice(0, 7);
}

export function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, day || 1));
}

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number) {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  return x.toISOString().slice(0, 7);
}

export function monthStart(month: string) {
  return month + '-01';
}

export function monthEnd(month: string) {
  const [y, m] = month.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m, 0)));
}

export function monthsBetween(a: string, b: string) {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function weekday(d: string) {
  return parse(d).getUTCDay();
}

export function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const [y, m, day] = s.split('-').map(Number);
  return `${day}-${MONTHS[m - 1]?.toLowerCase()}, ${y}`;
}

export function fmtShort(d?: string | null) {
  if (!d) return '—';
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

export function fmtMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

export function relative(d: Date | string) {
  const t = typeof d === 'string' ? new Date(d) : d;
  const diff = (Date.now() - t.getTime()) / 1000;
  if (diff < 60) return 'hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days} kun oldin`;
  return fmtDate(t);
}

export type Period = 'bugun' | 'hafta' | 'oy' | 'yil';

export function periodRange(p: Period, ref = today()): { from: string; to: string; label: string } {
  if (p === 'bugun') return { from: ref, to: ref, label: 'Bugun' };
  if (p === 'hafta') {
    const wd = (weekday(ref) + 6) % 7; // dushanbadan
    const from = addDays(ref, -wd);
    return { from, to: addDays(from, 6), label: 'Shu hafta' };
  }
  if (p === 'yil') {
    const y = ref.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}-yil` };
  }
  const m = ref.slice(0, 7);
  return { from: monthStart(m), to: monthEnd(m), label: fmtMonth(m) };
}

/** Guruh dars kunlari: "Du,Chor,Ju" */
export const DAY_CODES = ['Du', 'Se', 'Chor', 'Pa', 'Ju', 'Sha', 'Ya'];
export function groupHasLessonOn(days: string, d: string) {
  const code = WEEKDAYS[weekday(d)];
  return days.split(',').map((s) => s.trim()).includes(code);
}
