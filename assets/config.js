window.LIMEWOOD_CONFIG = {
  supabaseUrl: 'https://sswedojvkqvoqmwhfmkj.supabase.co',
  supabasePublishableKey: 'sb_publishable_BoOHg11kfg6FB3xhQHW-dw_yal1q1Yu',
  storageBucket: 'asset-files'
};
window.LIMEWOOD_BMS = {
  baseUrl: 'https://192.168.170.100',
  readOnly: true,
  hostName: 'WINDOWS-3732600'
};

// Location-aware navigation + friendly search + dashboard v8 skin.
(() => {
  const isHome=/^\/(?:index\.html)?$/i.test(location.pathname);
  const isPhotoInbox=/\/photo-inbox(?:\.html)?\/?$/i.test(location.pathname);
  const returnKey='lw-auth-return';
  const safeReturnPath=value=>{
    const v=String(value||'');
    return v.startsWith('/')&&!v.startsWith('//')?v:'';
  };

  function installVisibleZipImporter(){
    if(!isPhotoInbox||document.getElementById('lwZipImport'))return;
    const photoInput=document.getElementById('photoFiles');
    if(!photoInput)return;
    const btn=document.createElement('button');
    btn.id='lwZipImport';
    btn.type='button';
    btn.textContent='Import ZIP';
    btn.style.cssText='width:100%;margin-top:10px;border:2px solid #17372c;background:#fff;color:#17372c;padding:12px 14px;border-radius:10px;font-weight:800;font-size:15px';
    const note=document.createElement('div');
    note.id='lwZipImportNote';
    note.textContent='ZIP upload: up to 50 MB / 250 images';
    note.style.cssText='margin-top:6px;text-align:center;font-size:11px;color:#6b746f';
    const zipInput=document.createElement('input');
    zipInput.type='file';
    zipInput.accept='.zip,application/zip,application/x-zip-compressed';
    zipInput.style.display='none';
    btn.insertAdjacentElement('afterend',note);
    note.insertAdjacentElement('afterend',zipInput);
    photoInput.closest('.dropZone')?.insertAdjacentElement('afterend',btn);

    const status=document.getElementById('uploadStatus');
    async function getJSZip(){
      if(window.JSZip)return window.JSZip;
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Could not load ZIP support.'));
        document.head.appendChild(s);
      });
      if(!window.JSZip)throw new Error('ZIP support did not initialise.');
      return window.JSZip;
    }
    btn.addEventListener('click',()=>zipInput.click());
    zipInput.addEventListener('change',async()=>{
      const file=zipInput.files?.[0];
      if(!file)return;
      try{
        if(file.size>50*1024*1024)throw new Error('ZIP is over the 50 MB limit.');
        btn.disabled=true;
        btn.textContent='Unpacking ZIP…';
        if(status){status.className='status';status.textContent='Reading ZIP…';}
        const JSZip=await getJSZip();
        const zip=await JSZip.loadAsync(file);
        const entries=Object.values(zip.files).filter(e=>!e.dir&&/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(e.name));
        if(!entries.length)throw new Error('No supported images found in the ZIP.');
        if(entries.length>250)throw new Error(`ZIP contains ${entries.length} images. Limit is 250.`);
        const dt=new DataTransfer();
        const mime=n=>/\.png$/i.test(n)?'image/png':/\.webp$/i.test(n)?'image/webp':/\.gif$/i.test(n)?'image/gif':/\.hei[cf]$/i.test(n)?'image/heic':'image/jpeg';
        for(const entry of entries){
          const blob=await entry.async('blob');
          const safe=entry.name.replace(/^\/+|\/+$/g,'').replace(/[\\/]+/g,'__').replace(/[^a-zA-Z0-9._-]+/g,'_');
          dt.items.add(new File([blob],safe,{type:mime(entry.name),lastModified:file.lastModified||Date.now()}));
        }
        photoInput.files=dt.files;
        photoInput.dispatchEvent(new Event('change',{bubbles:true}));
        if(status){status.className='status success';status.textContent=`Unpacked ${entries.length} photos from ${file.name}. Ready to upload.`;}
      }catch(e){
        if(status){status.className='status error';status.textContent=e?.message||String(e);}
      }finally{
        btn.disabled=false;
        btn.textContent='Import ZIP';
        zipInput.value='';
      }
    });
  }

  if(isPhotoInbox){
    try{sessionStorage.setItem(returnKey,location.pathname+location.search+location.hash);}catch(_){}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installVisibleZipImporter,{once:true});else installVisibleZipImporter();
    queueMicrotask(async()=>{
      try{
        if(!window.supabase)return;
        const authClient=window.supabase.createClient(
          window.LIMEWOOD_CONFIG.supabaseUrl,
          window.LIMEWOOD_CONFIG.supabasePublishableKey,
          {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}
        );
        const {data}=await authClient.auth.getSession();
        if(data?.session)sessionStorage.removeItem(returnKey);
      }catch(_){}
    });
  }

  if(isHome){
    let pending='';
    try{pending=safeReturnPath(sessionStorage.getItem(returnKey));}catch(_){}
    if(pending){
      queueMicrotask(async()=>{
        try{
          if(!window.supabase)return;
          const authClient=window.supabase.createClient(
            window.LIMEWOOD_CONFIG.supabaseUrl,
            window.LIMEWOOD_CONFIG.supabasePublishableKey,
            {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
          );
          let leaving=false;
          const goBack=()=>{
            if(leaving)return;
            let target='';
            try{
              target=safeReturnPath(sessionStorage.getItem(returnKey));
              sessionStorage.removeItem(returnKey);
            }catch(_){}
            if(target){leaving=true;location.replace(target);}
          };
          const {data}=await authClient.auth.getSession();
          if(data?.session){goBack();return;}
          authClient.auth.onAuthStateChange((_event,session)=>{
            if(session)setTimeout(goBack,0);
          });
        }catch(_){}
      });
    }
  }

  const nav=document.createElement('script'); nav.src='/assets/location-registers.js?v=20260819-2'; document.head.appendChild(nav);
  const search=document.createElement('script'); search.src='/assets/dashboard-search.js?v=20260918-room-intelligence-1'; document.head.appendChild(search);
  const style=document.createElement('link'); style.rel='stylesheet'; style.href='/assets/dashboard-v8.css?v=20260830-5'; document.head.appendChild(style);
  const dash=document.createElement('script'); dash.src='/assets/dashboard-v8.js?v=20260819-3'; document.head.appendChild(dash);
  const staffElectricalRoute=document.createElement('script'); staffElectricalRoute.src='/assets/staff-house-electrical-route.js?v=20260830-1'; document.head.appendChild(staffElectricalRoute);
  if(!isHome){
    const siteSidebar=document.createElement('script'); siteSidebar.src='/assets/site-sidebar.js?v=20260830-2'; document.head.appendChild(siteSidebar);
  }
  if(isHome){
    const sopActions=document.createElement('script'); sopActions.src='/assets/sop-actions-stable.js?v=20260917-2'; document.head.appendChild(sopActions);
    const documentCentre=document.createElement('script'); documentCentre.src='/assets/document-centre-v2.js?v=20260829-3'; document.head.appendChild(documentCentre);
    const reviewLayout=document.createElement('script'); reviewLayout.src='/assets/review-layout-fix.js?v=20260829-1'; document.head.appendChild(reviewLayout);
  }
  if(/\/systems\.html$/i.test(location.pathname)){
    const systemsLocationFix=document.createElement('script'); systemsLocationFix.src='/assets/systems-location-default.js?v=20260901-1'; document.head.appendChild(systemsLocationFix);
  }
  if(/\/maintenance-dashboard\.html$/i.test(location.pathname)){
    const maintenanceAssetPicker=document.createElement('script'); maintenanceAssetPicker.src='/assets/maintenance-asset-picker.js?v=20260828-1'; document.head.appendChild(maintenanceAssetPicker);
  }
  if(isPhotoInbox){
    const photoBatch=document.createElement('script'); photoBatch.src='/assets/photo-inbox-batch.js?v=20260921-zip3'; document.head.appendChild(photoBatch);
    const photoInboxRedesign=document.createElement('link'); photoInboxRedesign.rel='stylesheet'; photoInboxRedesign.href='/assets/photo-inbox-redesign.css?v=20260901-4'; document.head.appendChild(photoInboxRedesign);
    const stanChat=document.createElement('link'); stanChat.rel='stylesheet'; stanChat.href='/assets/stan-chat.css?v=20260901-3'; document.head.appendChild(stanChat);
    const stanHeader=document.createElement('script'); stanHeader.src='/assets/photo-inbox-stan.js?v=20260917-1'; document.head.appendChild(stanHeader);
    const reviewTools=document.createElement('script'); reviewTools.src='/assets/photo-inbox-review-tools.js?v=20260917-1'; document.head.appendChild(reviewTools);
  }
  if(/\/electrical-distribution\.html$/i.test(location.pathname)){
    const electricalLayout=document.createElement('link'); electricalLayout.rel='stylesheet'; electricalLayout.href='/assets/electrical-distribution-newlayout.css?v=20260830-3'; document.head.appendChild(electricalLayout);
  }
})();
