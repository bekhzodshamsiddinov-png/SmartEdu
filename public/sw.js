/* SmartEdu ota-ona ilovasi: faqat umumiy statik fayllar keshlanadi.
   Shaxsiy sahifalar (balans, QR kalit, havolalar) telefonda saqlanmaydi. */
const CACHE = 'ilova-v2';
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Internet yo\'q</title><body style="font-family:system-ui;background:#F2F4F9;color:#0C1631;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:44px">📡</div><h1 style="font-size:22px">Internet yo\'q</h1><p style="color:#5B6478">Internetga ulaning va sahifani yangilang.</p></div>';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // Eski versiyalardagi (shaxsiy sahifalar saqlangan bo'lishi mumkin) keshlar o'chiriladi
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  if (req.mode === 'navigate' && url.pathname.startsWith('/ilova')) {
    e.respondWith(fetch(req).catch(() => new Response(OFFLINE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })));
  }
});
