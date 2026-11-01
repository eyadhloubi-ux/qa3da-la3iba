/* قعدة لعّيبة — كاش بسيط: الشبكة أولاً وبعدين الكاش */
const C = 'la3iba-v5';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'engine.js', 'games.js', 'story.js', 'art.js', 'qrcode.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('/health') || u.pathname.startsWith('/stats') || u.pathname.startsWith('/ws')) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)).catch(() => {}); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
