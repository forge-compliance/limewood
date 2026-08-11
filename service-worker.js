const CACHE = 'limewood-cache-v2';

const SHELL = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Supabase requests
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML / JS / CSS should prefer the network
  const isCore =
    req.mode === 'navigate' ||
    (
      url.origin === self.location.origin &&
      (
        url.pathname === '/' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css')
      )
    );

  if (isCore) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (!res || !res.ok) return res;

          const cacheCopy = res.clone();

          event.waitUntil(
            caches.open(CACHE).then(cache => {
              const key = req.mode === 'navigate'
                ? '/index.html'
                : req;

              return cache.put(key, cacheCopy);
            })
          );

          return res;
        })
        .catch(() => {
          return req.mode === 'navigate'
            ? caches.match('/index.html')
            : caches.match(req);
        })
    );

    return;
  }

  // Other same-origin resources: cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;

        return fetch(req).then(res => {
          if (!res || !res.ok) return res;

          const cacheCopy = res.clone();

          event.waitUntil(
            caches.open(CACHE).then(cache =>
              cache.put(req, cacheCopy)
            )
          );

          return res;
        });
      })
    );
  }
});
