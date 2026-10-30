// Service worker de la página de prueba: guarda la página y sirve el audio sin conexión.
const CACHE = 'prueba-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Los reproductores de audio piden trozos (Range): hay que responderlos a mano desde la caché.
  if (req.headers.has('range')) { e.respondWith(rangeResponse(req)); return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

async function rangeResponse(req) {
  const cache = await caches.open(CACHE);
  const res = await cache.match(req.url);
  if (!res) return fetch(req);
  const buf = await res.arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range')) || [];
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : total - 1;
  if (!m[1] && m[2]) { start = total - parseInt(m[2], 10); end = total - 1; }
  end = Math.min(end, total - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}
