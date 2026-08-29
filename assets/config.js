window.LIMEWOOD_CONFIG = {
  supabaseUrl: 'https://sswedojvkqvoqmwhfmkj.supabase.co',
  supabasePublishableKey: 'sb_publishable_BoOHg11kfg6FB3xhQHW-dw_yal1q1Yu',
  storageBucket: 'asset-files'
};
window.LIMEWOOD_BMS = {baseUrl:'https://192.168.170.100',readOnly:true,hostName:'WINDOWS-3732600'};
(() => {
 const add=(tag,props)=>{const e=document.createElement(tag);Object.assign(e,props);document.head.appendChild(e);};
 add('script',{src:'/assets/location-registers.js?v=20260819-2'});
 add('script',{src:'/assets/dashboard-search.js?v=20260819-1'});
 add('link',{rel:'stylesheet',href:'/assets/dashboard-v8.css?v=20260819-4'});
 add('script',{src:'/assets/dashboard-v8.js?v=20260819-3'});
 add('link',{rel:'stylesheet',href:'/assets/navigation-v9.css?v=20260829-1'});
 add('script',{src:'/assets/navigation-v9.js?v=20260829-1'});
 if(/^\/(?:index\.html)?$/i.test(location.pathname)){
   add('script',{src:'/assets/sop-builder.js?v=20260829-2'});
   add('script',{src:'/assets/sop-pdf-download.js?v=20260829-1'});
 }
 add('script',{src:'/assets/sop-photo-links.js?v=20260829-3'});
 if(/\/maintenance-dashboard\.html$/i.test(location.pathname))add('script',{src:'/assets/maintenance-asset-picker.js?v=20260828-1'});
 if(/\/photo-inbox\.html$/i.test(location.pathname))add('script',{src:'/assets/photo-inbox-batch.js?v=20260829-2'});
})();