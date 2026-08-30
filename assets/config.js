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
  const nav=document.createElement('script'); nav.src='/assets/location-registers.js?v=20260819-2'; document.head.appendChild(nav);
  const search=document.createElement('script'); search.src='/assets/dashboard-search.js?v=20260819-1'; document.head.appendChild(search);
  const style=document.createElement('link'); style.rel='stylesheet'; style.href='/assets/dashboard-v8.css?v=20260819-4'; document.head.appendChild(style);
  const dash=document.createElement('script'); dash.src='/assets/dashboard-v8.js?v=20260819-3'; document.head.appendChild(dash);
  const staffElectricalRoute=document.createElement('script'); staffElectricalRoute.src='/assets/staff-house-electrical-route.js?v=20260830-1'; document.head.appendChild(staffElectricalRoute);
  if(/^\/(?:index\.html)?$/i.test(location.pathname)){
    const sopActions=document.createElement('script'); sopActions.src='/assets/sop-actions-stable.js?v=20260829-1'; document.head.appendChild(sopActions);
    const documentCentre=document.createElement('script'); documentCentre.src='/assets/document-centre-v2.js?v=20260829-3'; document.head.appendChild(documentCentre);
    const reviewLayout=document.createElement('script'); reviewLayout.src='/assets/review-layout-fix.js?v=20260829-1'; document.head.appendChild(reviewLayout);
  }
  if(/\/maintenance-dashboard\.html$/i.test(location.pathname)){
    const maintenanceAssetPicker=document.createElement('script'); maintenanceAssetPicker.src='/assets/maintenance-asset-picker.js?v=20260828-1'; document.head.appendChild(maintenanceAssetPicker);
  }
  if(/\/photo-inbox\.html$/i.test(location.pathname)){
    const photoBatch=document.createElement('script'); photoBatch.src='/assets/photo-inbox-batch.js?v=20260830-2'; document.head.appendChild(photoBatch);
  }
  if(/\/electrical-distribution\.html$/i.test(location.pathname)){
    const electricalLayout=document.createElement('link'); electricalLayout.rel='stylesheet'; electricalLayout.href='/assets/electrical-distribution-newlayout.css?v=20260830-1'; document.head.appendChild(electricalLayout);
    const addElectricalLocations=()=>{
      const select=document.getElementById('editPlantRoom');
      if(!select)return;
      ['Office','Staff House Switchboard Room'].forEach(name=>{
        if(![...select.options].some(o=>o.value===name)){
          const option=document.createElement('option');
          option.value=name;
          option.textContent=name;
          select.appendChild(option);
        }
      });
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addElectricalLocations);
    else addElectricalLocations();
  }
})();