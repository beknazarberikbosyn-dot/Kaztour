/* Samruk Travel service worker: the site and saved trips open with no mobile signal.
   - the page itself: network first, so updates arrive; the saved copy when offline
   - our own files and libraries: from the cache, refreshed in the background
   - map tiles and photos you have seen: kept, with a size limit
   - "Save for offline" sends a list of files for one trip, cached here */
const V = 'samruk-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/parks/parks.css', 'assets/parks/parks.js', 'assets/parks/i18n.js',
  'assets/parks/qrcode.js', 'assets/parks/icon-192.png', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const LIMITS = { [V + '-tiles']: 900, [V + '-img']: 160 };

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name) {
  const max = LIMITS[name]; if (!max) return;
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(name); c.put(req, res.clone()).then(() => trim(name)); }
  return res;
}
async function staleWhileRevalidate(req) {
  const hit = await caches.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(V).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
  return hit || net;
}
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) { const c = await caches.open(V); c.put(req, res.clone()); }
    return res;
  } catch (err) {
    return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  if (u.hostname.endsWith('tile.openstreetmap.org')) { e.respondWith(cacheFirst(req, V + '-tiles')); return; }
  if (u.hostname === 'commons.wikimedia.org' || u.hostname === 'upload.wikimedia.org') { e.respondWith(cacheFirst(req, V + '-img')); return; }
  if (/^(unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) { e.respondWith(cacheFirst(req, V)); return; }
  if (u.origin === self.location.origin) {
    if (u.pathname.endsWith('.mp3')) { e.respondWith(caches.match(req.url).then((h) => h || fetch(req))); return; } // narration saved with a trip plays offline
    e.respondWith(staleWhileRevalidate(req)); return;
  }
  // everything else (Google panoramas, YouTube): straight to the network
});

/* "Save for offline": cache the files of one trip and report how many arrived */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'pack') return;
  const port = e.ports && e.ports[0];
  e.waitUntil((async () => {
    let ok = 0;
    await Promise.all((d.urls || []).map(async (url) => {
      try {
        const same = new URL(url, self.registration.scope).origin === self.location.origin;
        const name = /wikimedia/.test(url) ? V + '-img' : V;
        const req = new Request(url, same ? {} : { mode: 'no-cors' });
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) { await (await caches.open(name)).put(req, res); ok++; }
      } catch (err) { /* one missing file does not stop the rest */ }
    }));
    if (port) port.postMessage({ ok, total: (d.urls || []).length });
  })());
});
