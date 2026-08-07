
const CACHE='limewood-engineering-v1';
const CORE=['./','index.html','styles.css','app.js','manifest.json','data/database.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
