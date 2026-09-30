(()=>{
  if(!/\/photo-inbox(?:\.html)?$/i.test(location.pathname)) return;
  let client;
  const getClient=()=>{
    if(client) return client;
    const cfg=window.LIMEWOOD_CONFIG;
    if(!cfg||!window.supabase) return null;
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  };
  const roomNo=()=>{
    const t=(document.getElementById('reviewMeta')?.innerText||'')+' '+(document.getElementById('reviewImg')?.src||'');
    const m=t.match(/room[_\s-]*0?(\d{1,2})/i);
    return m?Number(m[1]):null;
  };
  const show=async()=>{
    const panel=document.getElementById('relatedRoomPhotoPanel');
    const n=roomNo();
    if(!panel||!n) return;
    panel.innerHTML='Loading Room '+n+' survey photos…';
    const c=getClient(); if(!c) return;
    const a=`%Room_${String(n).padStart(2,'0')}%`;
    const b=`%Room ${n}%`;
    const {data,error}=await c.from('photo_inbox').select('original_filename,storage_path').or(`original_filename.ilike.${a},original_filename.ilike.${b}`).order('created_at',{ascending:true}).limit(12);
    if(error){panel.textContent='Could not load related photos.';return;}
    const links=[];
    for(const r of data||[]){
      if(!r.storage_path) continue;
      const s=await c.storage.from(window.LIMEWOOD_CONFIG.storageBucket||'asset-files').createSignedUrl(r.storage_path,900);
      if(s.data?.signedUrl) links.push({name:r.original_filename,url:s.data.signedUrl});
    }
    if(!links.length){panel.textContent='No additional Room '+n+' survey photos found.';return;}
    panel.innerHTML='<b>Related Room '+n+' photos</b><div style="font-size:11px;color:#68736d;margin:4px 0 8px">Open these to inspect the area around the consumer unit or local isolators.</div>';
    links.forEach((x,i)=>{
      const a=document.createElement('a');
      a.href=x.url;a.target='_blank';a.rel='noopener';a.textContent='Open photo '+(i+1);
      a.style.cssText='display:block;margin:5px 0;padding:9px 10px;border-radius:9px;background:#17372c;color:#fff;text-decoration:none;font-weight:800;font-size:12px';
      panel.appendChild(a);
    });
  };
  const bind=()=>{
    const img=document.getElementById('reviewImg');
    if(!img||document.getElementById('relatedRoomPhotoPanel')) return;
    const panel=document.createElement('div');panel.id='relatedRoomPhotoPanel';panel.style.cssText='margin:8px 0;padding:10px;border:1px solid #d9e1dc;border-radius:10px;background:#f7faf8;font-size:12px';
    img.insertAdjacentElement('afterend',panel);
    img.addEventListener('load',()=>setTimeout(show,120));
    new MutationObserver(()=>setTimeout(show,120)).observe(img,{attributes:true,attributeFilter:['src']});
    setTimeout(show,150);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();