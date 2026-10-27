import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';

/** Ota-ona ilovasi telefonga "ilova" sifatida o'rnatiladi (PWA) */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: `${s.centerName} — ota-ona ilovasi`,
    short_name: s.centerName.length > 12 ? 'UITC' : s.centerName,
    description: "Davomat, to'lovlar, abonement va QR davomat",
    start_url: '/ilova',
    scope: '/ilova',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2F4F9',
    theme_color: '#0C1631',
    lang: 'uz',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
