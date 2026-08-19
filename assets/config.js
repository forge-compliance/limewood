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
  style.href='/assets/dashboard-v8.css?v=20260819-2';
  document.head.appendChild(style);

  const dash=document.createElement('script');
  dash.src='/assets/dashboard-v8.js?v=20260819-2';
  document.head.appendChild(dash);
})();
