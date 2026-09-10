const CACHE = 'limewood-static-v3';

// Limewood operational data is cloud-only. The service worker must never
// present a stale HTML/JS application shell that can look like a live system.
// Only harmless static install assets are cached.
const STATIC = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).catch(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase is always live network-only.
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // The application shell is also network-only. If Cloudflare is unavailable,
  // show a real network error rather than an old UI with misleading zero counts.
  if (
    req.mode === 'navigate' ||
    (
      url.origin === self.location.origin &&
      (
        url.pathname === '/' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css')
      )
    )
  ) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Cache only harmless same-origin static assets such as icons.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          if (!res || !res.ok) return res;
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE).then(cache => cache.put(req, copy))
          );
          return res;
        })
      )
    );
  }
});
