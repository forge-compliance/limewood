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
  const nav=document.createElement('script');
  nav.src='/assets/location-registers.js?v=20260819-2';
  document.head.appendChild(nav);

  const search=document.createElement('script');
  search.src='/assets/dashboard-search.js?v=20260819-1';
  document.head.appendChild(search);

  const style=document.createElement('link');
  style.rel='stylesheet';
  style.href='/assets/dashboard-v8.css?v=20260819-4';
  document.head.appendChild(style);

  const dash=document.createElement('script');
  dash.src='/assets/dashboard-v8.js?v=20260819-3';
  document.head.appendChild(dash);

  if(/^\/(?:index\.html)?$/i.test(location.pathname)){
    const sopActions=document.createElement('script');
    sopActions.src='/assets/sop-actions-stable.js?v=20260829-1';
    document.head.appendChild(sopActions);

    const documentCentre=document.createElement('script');
    documentCentre.src='/assets/document-centre-v2.js?v=20260829-1';
    document.head.appendChild(documentCentre);
  }

  if(/\/maintenance-dashboard\.html$/i.test(location.pathname)){
    const maintenanceAssetPicker=document.createElement('script');
    maintenanceAssetPicker.src='/assets/maintenance-asset-picker.js?v=20260828-1';
    document.head.appendChild(maintenanceAssetPicker);
  }

  if(/\/photo-inbox\.html$/i.test(location.pathname)){
    const photoBatch=document.createElement('script');
    photoBatch.src='/assets/photo-inbox-batch.js?v=20260829-1';
    document.head.appendChild(photoBatch);
  }
})();
