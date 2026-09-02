/* Keep the PPM detail modal fully scrollable on mobile without forcing it visible. */
(()=>{
'use strict';
if(document.getElementById('ppmModalScrollFix'))return;
const s=document.createElement('style');
s.id='ppmModalScrollFix';
s.textContent=`
#ppmModal{
  overflow-y:auto!important;
  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
  align-items:flex-start!important;
  padding-top:max(12px,env(safe-area-inset-top))!important;
  padding-bottom:max(28px,calc(env(safe-area-inset-bottom) + 18px))!important;
}
#ppmModal .modalCard{
  max-height:none!important;
  height:auto!important;
  overflow:visible!important;
  margin:auto!important;
  margin-bottom:max(32px,calc(env(safe-area-inset-bottom) + 24px))!important;
}
@media(max-width:700px){
  #ppmModal.open,
  #ppmModal[aria-hidden="false"]{
    display:block!important;
  }
  #ppmModal:not(.open)[aria-hidden="true"]{
    display:none!important;
  }
  #ppmModal{
    padding-left:0!important;
    padding-right:0!important;
    padding-bottom:max(56px,calc(env(safe-area-inset-bottom) + 44px))!important;
  }
  #ppmModal .modalCard{
    width:100%!important;
    max-width:100%!important;
    min-height:auto!important;
    border-radius:0!important;
    margin:0!important;
    padding-bottom:max(72px,calc(env(safe-area-inset-bottom) + 60px))!important;
  }
  #ppmModal .modalActions{
    position:relative!important;
    margin-bottom:20px!important;
    padding-bottom:8px!important;
  }
}
`;
document.head.appendChild(s);
})();
