// Service worker: la app abre al instante y sin conexión; los datos siempre se piden en vivo.
const VERSION = 'mf-v5-5';
const ARCHIVOS = ['./', 'index.html', 'app.css', 'app.js', 'logos.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
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
  if (/play-lh\.googleusercontent\.com|google\.com\/s2\/favicons|fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    e.respondWith(caches.open(VERSION + '-ext').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  // Archivos de la app: red primero (para recibir mejoras), caché si no hay conexión.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
  }
});
