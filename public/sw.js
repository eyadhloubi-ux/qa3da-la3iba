/* قعدة لعّيبة — كاش سريع: بيفتح من الكاش فوراً وبيحدّث بالخلفية */
const C = 'la3iba-v10';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'engine.js', 'games.js', 'story.js', 'art.js', 'qrcode.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (e.request.method !== 'GET') return;
  if (!isFont && (u.origin !== location.origin || /\/(health|stats|admin|config|ws)/.test(u.pathname))) return;
  e.respondWith(caches.open(C).then(c => c.match(e.request, { ignoreSearch: !isFont }).then(hit => {
    const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()).catch(() => {}); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match('index.html'));
  })));
});
