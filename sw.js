// Bunglon Wiki — service worker v3: shell cache + API stale-while-revalidate
const SHELL = 'bw-shell-v3';
const API = 'bw-api-v3';
const SHELL_FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const API_HOSTS = ['id.wikipedia.org', 'commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'openlibrary.org', 'covers.openlibrary.org', 'api.openalex.org', 'archive.org'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)));
});
self.addEventListener('activate', e => {
  self.clients.claim();
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, API].includes(k)).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // file media (gambar/video) — cache-first
  if (/\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|ogg)(\?.*)?$/i.test(url.pathname) || url.host.endsWith('.wikimedia.org') || url.host === 'upload.wikimedia.org' || url.host === 'thumb.wikimedia.org') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(API).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }
  // API JSON — stale-while-revalidate
  if (API_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(API).then(async cache => {
        const cached = await cache.match(e.request);
        const fetching = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetching;
      })
    );
    return;
  }
  // shell sendiri — cache-first
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
});
