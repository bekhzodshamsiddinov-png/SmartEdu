import { ImageResponse } from 'next/og';
import { courseBySlug } from '@/lib/academy';
import { getSettings } from '@/lib/settings';

export const alt = 'Onlayn kurs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ');

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [c, s] = await Promise.all([courseBySlug((await params).slug), getSettings()]);
  const title = c && c.status !== 'qoralama' ? c.title : 'Onlayn kurs';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#F2F4F9', color: '#0C1631' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, fontWeight: 700, color: '#0B78A6' }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: c?.color ?? '#D93A08' }} />
          {s.centerName} Akademiya
        </div>
        <div style={{ fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, display: 'flex' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {c && c.status !== 'qoralama' && c.price > 0 && <div style={{ display: 'flex', background: '#D93A08', color: 'white', borderRadius: 999, padding: '14px 28px', fontSize: 34, fontWeight: 800 }}>{fmt(c.price)} so&apos;m</div>}
          <div style={{ display: 'flex', fontSize: 30, color: '#5B6478' }}>Video darslar · amaliy topshiriqlar</div>
        </div>
      </div>
    ),
    size,
  );
}
