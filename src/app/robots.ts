import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/payments';

/** Qidiruv tizimlari faqat ochiq akademiya sahifalarini ko'radi; CRM, ota-ona kabineti va ilova indekslanmaydi */
export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/akademiya', '/sitemap.xml'],
        disallow: ['/', '/akademiya/kabinet', '/akademiya/tolov', '/akademiya/oqish', '/akademiya/kirish', '/api', '/ilova', '/ota-ona'],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
