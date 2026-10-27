import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/settings';

export const alt = 'Onlayn akademiya';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Ijtimoiy tarmoqlarda ulashilganda chiqadigan rasm */
export default async function Image() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#0C1631', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, fontWeight: 700, color: '#7CE0C8' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: '#D93A08' }} />
          {s.centerName} Akademiya
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Sun&apos;iy intellekt va YouTube</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: '#C4F03C' }}>amaliy onlayn kurslari</div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 28, color: 'rgba(255,255,255,0.75)' }}>
          <span>Video darslar</span>
          <span>·</span>
          <span>Topshiriqlar</span>
          <span>·</span>
          <span>Sertifikat</span>
          <span>·</span>
          <span>O&apos;zbek tilida</span>
        </div>
      </div>
    ),
    size,
  );
}
