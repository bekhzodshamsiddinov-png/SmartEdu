import type { MetadataRoute } from 'next';

/** Qidiruv tizimlari faqat ochiq akademiya sahifalarini ko'radi; CRM va shaxsiy sahifalar indekslanmaydi */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/akademiya'], disallow: ['/', '/akademiya/kabinet', '/akademiya/tolov', '/akademiya/oqish', '/akademiya/kirish', '/api'] }],
  };
}
