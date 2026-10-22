// Guarda la app en el móvil para que funcione sin internet.
// Con internet siempre carga la última versión de la página; sin internet usa la copia guardada.
// Si cambias algún archivo, sube también este con la versión cambiada (v2, v3...).
const VERSION = 'caja-santa-espina-v9';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function conLimite(p, ms) { return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('tiempo')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); }); }); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // La página: primero internet (con límite de 4 s); si no hay, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(conLimite(fetch(req, { cache: 'no-store' }), 4000).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copia)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // Iconos y demás: la copia guardada y, si no está, internet
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return res;
  })));
});
