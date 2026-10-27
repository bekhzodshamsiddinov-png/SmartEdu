import 'server-only';
import { getSettings } from './settings';
import { siteUrl } from './payments';

/** Markaz haqida schema.org ma'lumoti (EducationalOrganization + LocalBusiness) */
export async function organizationLd() {
  const s = await getSettings();
  const url = siteUrl();
  const same = [s.telegram && `https://t.me/${s.telegram.replace(/^@/, '')}`, s.instagram && `https://instagram.com/${s.instagram.replace(/^@/, '')}`].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    '@id': `${url}/akademiya#org`,
    name: s.centerName,
    url: `${url}/akademiya`,
    logo: `${url}/icons/icon-512.png`,
    image: `${url}/akademiya/opengraph-image`,
    ...(s.phone ? { telephone: `+${s.phone}` } : {}),
    ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'UZ' } } : {}),
    ...(same.length ? { sameAs: same } : {}),
    areaServed: 'UZ',
    knowsLanguage: ['uz', 'ru'],
  };
}

/** ISO 8601 davomiylik (daqiqadan) */
export const isoDuration = (min: number) => `PT${Math.floor(min / 60) ? `${Math.floor(min / 60)}H` : ''}${min % 60 ? `${min % 60}M` : ''}` || 'PT0M';
