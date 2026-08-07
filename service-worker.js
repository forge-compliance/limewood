
const CACHE='limewood-v7.1.4-master';
const SHELL=['/','/index.html','/assets/style.css','/assets/app.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  if(url.hostname.includes('supabase.co')){
    event.respondWith(fetch(req));
    return;
  }

  const isCore=req.mode==='navigate'||(
    url.origin===self.location.origin &&
    (url.pathname.endsWith('.html')||url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname==='/')
  );

  if(isCore){
    event.respondWith(
      fetch(req,{cache:'no-store'}).then(res=>{
        if(res&&res.ok){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req.mode==='navigate'?'/index.html':req,copy));
        }
        return res;
      }).catch(()=>req.mode==='navigate'?caches.match('/index.html'):caches.match(req))
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(cached=>cached||fetch(req).then(res=>{
        if(res&&res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));
        return res;
      }))
    );
  }
});
