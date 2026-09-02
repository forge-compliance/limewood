/* PPM detail modal scrolling: keep the modal itself as the scroll container so long service records reach the action buttons. */
(()=>{
  'use strict';
  const install=()=>{
    if(document.getElementById('ppmModalScrollV2'))return;
    const style=document.createElement('style');
    style.id='ppmModalScrollV2';
    style.textContent=`
      #ppmModal.ppmDetailModal{
        overflow-x:hidden!important;
        overflow-y:auto!important;
        -webkit-overflow-scrolling:touch!important;
        align-items:flex-start!important;
        overscroll-behavior:contain;
        padding-top:max(12px,env(safe-area-inset-top))!important;
        padding-bottom:max(36px,env(safe-area-inset-bottom))!important;
      }
      #ppmModal.ppmDetailModal .ppmDetailCard{
        max-height:none!important;
        height:auto!important;
        overflow:visible!important;
        margin:0 auto max(36px,env(safe-area-inset-bottom))!important;
      }
      #ppmModal.ppmDetailModal .modalActions{
        position:relative!important;
        bottom:auto!important;
        padding-bottom:max(12px,env(safe-area-inset-bottom))!important;
      }
      @media(max-width:700px){
        #ppmModal.ppmDetailModal{display:block!important;}
        #ppmModal.ppmDetailModal[aria-hidden="true"]{display:none!important;}
        #ppmModal.ppmDetailModal .ppmDetailCard{width:100%!important;min-height:0!important;}
      }
    `;
    document.head.appendChild(style);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
  else install();
})();
