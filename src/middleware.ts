import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

const PUBLIC = ['/login', '/setup', '/akademiya', '/ota-ona', '/ilova', '/icons', '/sw.js', '/manifest.webmanifest', '/sitemap.xml', '/api/payme', '/api/click', '/api/telegram'];
const isPublic = (p: string) => PUBLIC.some((x) => p === x || p.startsWith(x + '/') || p.startsWith(x + '?'));

/** Kontent xavfsizlik siyosati: faqat o'z skriptlarimiz (nonce bilan) ishlaydi — XSS bo'lsa ham begona kod ishga tushmaydi */
function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' https: blob:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net https://player.mediadelivery.net',
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

function withSecurity(req: NextRequest, redirectTo?: URL) {
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  if (redirectTo) {
    const r = NextResponse.redirect(redirectTo);
    r.headers.set('Content-Security-Policy', policy);
    return r;
  }
  const h = new Headers(req.headers);
  h.set('x-nonce', nonce);
  h.set('Content-Security-Policy', policy);
  const res = NextResponse.next({ request: { headers: h } });
  res.headers.set('Content-Security-Policy', policy);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/payme') || pathname.startsWith('/api/click') || pathname === '/api/telegram') return NextResponse.next();
  if (isPublic(pathname)) return withSecurity(req);
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return withSecurity(req, url);
  }
  return withSecurity(req);
}

export const config = {
  // Har bir so'rov (prefetch ham) himoyadan o'tadi
  matcher: ['/((?!_next/static/|_next/image|favicon\\.ico$|icon\\.svg$|robots\\.txt$|api/health$).*)'],
};
