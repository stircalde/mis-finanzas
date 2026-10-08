// Service worker: la app abre rápido y sin conexión; los datos siempre se piden en vivo.
const VERSION = 'mf-v5-75';
const ARCHIVOS = ['./', 'index.html', 'app.css', 'app.js', 'registro.js', 'admin.js', 'compartir.js', 'avisos.js', 'logos.js', 'cards.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Datos de Google Apps Script: siempre en vivo (la app guarda la última copia por su cuenta).
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com') && url.pathname.includes('macros')) return;
  // Logos y fuentes: se guardan la primera vez y se reutilizan.
  if (/play-lh\.googleusercontent\.com|google\.com\/s2\/favicons|icons\.duckduckgo\.com|gstatic\.com\/favicon|fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    e.respondWith(caches.open(VERSION + '-ext').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  // Archivos de la app: red primero (para recibir mejoras); si la red tarda más de 3 s o no hay conexión, la copia guardada.
  if (url.origin === self.location.origin) {
    const deCache = () => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
    e.respondWith(new Promise((resolve) => {
      let listo = false;
      const dar = (r) => { if (!listo && r) { listo = true; resolve(r); } };
      const t = setTimeout(() => deCache().then(dar), 3000);
      fetch(e.request, { cache: 'no-cache' }).then((r) => {
        clearTimeout(t);
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); if (!listo) { listo = true; resolve(r); } return; }
        // Error del servidor (404/500, p. ej. durante una publicación): mejor la última copia que funcionó.
        deCache().then((hit) => { if (!listo) { listo = true; resolve(hit || r); } });
      }).catch(() => { clearTimeout(t); deCache().then((hit) => { if (!listo) { listo = true; resolve(hit || Response.error()); } }); });
    }));
  }
});
