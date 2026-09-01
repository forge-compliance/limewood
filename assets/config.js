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
  const isPhotoInbox=/\/photo-inbox\.html$/i.test(location.pathname);
  const returnKey='lw-auth-return';
  const safeReturnPath=value=>{
    const v=String(value||'');
    return v.startsWith('/')&&!v.startsWith('//')?v:'';
  };

  // Remember why the user was sent to sign in. Photo Inbox itself still owns
  // the auth gate; this only preserves the destination across that redirect.
  if(isPhotoInbox){
    try{sessionStorage.setItem(returnKey,location.pathname+location.search+location.hash);}catch(_){}
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

  // If sign-in was opened because of a direct Photo Inbox shortcut, return to
  // that page as soon as a valid session exists instead of dumping the user on
  // the dashboard.
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
  const search=document.createElement('script'); search.src='/assets/dashboard-search.js?v=20260831-2'; document.head.appendChild(search);
  const style=document.createElement('link'); style.rel='stylesheet'; style.href='/assets/dashboard-v8.css?v=20260830-5'; document.head.appendChild(style);
  const dash=document.createElement('script'); dash.src='/assets/dashboard-v8.js?v=20260819-3'; document.head.appendChild(dash);
  const staffElectricalRoute=document.createElement('script'); staffElectricalRoute.src='/assets/staff-house-electrical-route.js?v=20260830-1'; document.head.appendChild(staffElectricalRoute);
  if(!isHome){
    const siteSidebar=document.createElement('script'); siteSidebar.src='/assets/site-sidebar.js?v=20260830-2'; document.head.appendChild(siteSidebar);
  }
  if(isHome){
    const sopActions=document.createElement('script'); sopActions.src='/assets/sop-actions-stable.js?v=20260829-1'; document.head.appendChild(sopActions);
    const documentCentre=document.createElement('script'); documentCentre.src='/assets/document-centre-v2.js?v=20260829-3'; document.head.appendChild(documentCentre);
    const reviewLayout=document.createElement('script'); reviewLayout.src='/assets/review-layout-fix.js?v=20260829-1'; document.head.appendChild(reviewLayout);
  }
  if(/\/maintenance-dashboard\.html$/i.test(location.pathname)){
    const maintenanceAssetPicker=document.createElement('script'); maintenanceAssetPicker.src='/assets/maintenance-asset-picker.js?v=20260828-1'; document.head.appendChild(maintenanceAssetPicker);
  }
  if(isPhotoInbox){
    const photoBatch=document.createElement('script'); photoBatch.src='/assets/photo-inbox-batch.js?v=20260830-3'; document.head.appendChild(photoBatch);
    const photoInboxRedesign=document.createElement('link'); photoInboxRedesign.rel='stylesheet'; photoInboxRedesign.href='/assets/photo-inbox-redesign.css?v=20260901-4'; document.head.appendChild(photoInboxRedesign);
    const stanChat=document.createElement('link'); stanChat.rel='stylesheet'; stanChat.href='/assets/stan-chat.css?v=20260901-3'; document.head.appendChild(stanChat);
    const stanHeader=document.createElement('script'); stanHeader.src='/assets/photo-inbox-stan.js?v=20260901-3'; document.head.appendChild(stanHeader);
  }
  if(/\/electrical-distribution\.html$/i.test(location.pathname)){
    const electricalLayout=document.createElement('link'); electricalLayout.rel='stylesheet'; electricalLayout.href='/assets/electrical-distribution-newlayout.css?v=20260830-3'; document.head.appendChild(electricalLayout);
  }
})();