
const CACHE='limewood-v6.4-shell';
const APP_SHELL=[
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);

  // Never cache Supabase/API traffic.
  if(url.hostname.includes('supabase.co')){
    event.respondWith(fetch(req));
    return;
  }

  // Navigation: network first, fall back to cached shell.
  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put('/index.html',copy));
          return res;
        })
        .catch(()=>caches.match('/index.html'))
    );
    return;
  }

  // Static same-origin assets: cache first, refresh in background.
  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(cached=>{
        const refresh=fetch(req).then(res=>{
          if(res&&res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));
          return res;
        }).catch(()=>cached);
        return cached||refresh;
      })
    );
  }
});
