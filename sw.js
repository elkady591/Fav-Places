// FAV Places offline cache. Bump VERSION when files change.
const VERSION = 'fav-places-v11';
const SHARE = 'fav-places-share';   // what Google Maps shared, kept until the page reads it
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  // Share -> FAV Places: keep what was shared on the phone and open the app
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const f = await req.formData();
      const data = { title: f.get('title') || '', text: f.get('text') || '', url: f.get('url') || '' };
      await (await caches.open(SHARE)).put('shared', new Response(JSON.stringify(data)));
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  // the sync store (Google Apps Script) must never be answered from the cache
  if (/(^|\.)google(usercontent)?\.com$/.test(new URL(req.url).hostname)) return;
  // app page: network first so updates arrive, cache when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // everything else (icons, fonts): cache first, fill cache on first use
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return r;
  })));
});
