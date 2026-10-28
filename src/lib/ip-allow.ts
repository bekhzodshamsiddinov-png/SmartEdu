import 'server-only';

/** So'rov yuborgan IP (Vercel ishonchli sarlavhasi; mahalliy muhitda x-forwarded-for) */
export function requestIp(req: Request) {
  const h = req.headers;
  return (h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for') ?? '').split(',')[0].trim();
}

function v4(ip: string) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

/**
 * To'lov tizimlari IP ro'yxati (masalan PAYME_ALLOWED_IPS="185.234.113.0/28,213.230.106.112/28").
 * Ro'yxat berilmagan bo'lsa — cheklov yo'q (imzo/kalit tekshiruvi baribir ishlaydi).
 */
export function ipAllowed(ip: string, list: string | undefined) {
  if (!list?.trim()) return true;
  const n = v4(ip);
  return list.split(',').some((raw) => {
    const e = raw.trim();
    if (!e) return false;
    if (e === ip) return true;
    const [base, bits] = e.split('/');
    const b = v4(base);
    const m = Number(bits);
    if (n === null || b === null || !bits || !Number.isInteger(m) || m < 0 || m > 32) return false;
    const mask = m === 0 ? 0 : (0xffffffff << (32 - m)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}
