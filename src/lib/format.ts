export function money(n: number | null | undefined, withUnit = true) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (v < 0 ? '−' : '') + s + (withUnit ? ' soʼm' : '');
}

export function compactMoney(n: number) {
  const v = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (v >= 1_000_000_000) return sign + (v / 1_000_000_000).toFixed(1).replace('.0', '') + ' mlrd';
  if (v >= 1_000_000) return sign + (v / 1_000_000).toFixed(1).replace('.0', '') + ' mln';
  if (v >= 1_000) return sign + Math.round(v / 1_000) + ' ming';
  return sign + v;
}

export function num(n: number) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function pct(n: number) {
  if (!isFinite(n)) return '—';
  return Math.round(n) + '%';
}

export function phone(p?: string | null) {
  if (!p) return '—';
  const d = p.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998'))
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return p;
}

export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, '');
  if (d.length === 9) return '998' + d;
  return d;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}
