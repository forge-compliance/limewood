/* Compact PPM dashboard and asset cards on phones. */
(()=>{
'use strict';
const style=document.createElement('style');
style.id='ppmMobileCompactStyles';
style.textContent=`
@media (max-width:700px){
  #ppmView .ppmDashboard{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:8px!important;
    margin:10px 0!important;
  }
  #ppmView .ppmStat{
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    padding:10px 12px!important;
    border-radius:12px!important;
    margin:0!important;
  }
  #ppmView .ppmStat span{
    display:block!important;
    font-size:10px!important;
    line-height:1.15!important;
    margin:0 0 5px!important;
    letter-spacing:.08em!important;
  }
  #ppmView .ppmStat b{
    display:block!important;
    font-size:28px!important;
    line-height:1!important;
    margin:0 0 5px!important;
  }
  #ppmView .ppmStat small{
    display:block!important;
    font-size:9px!important;
    line-height:1.2!important;
    margin:0!important;
  }
  #ppmView .ppmStat.compliance{
    grid-column:1 / -1!important;
  }

  #ppmView #ppmCards.ppmTaskGrid{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:7px!important;
  }
  #ppmView .ppmTaskCard{
    position:relative!important;
    min-height:0!important;
    height:auto!important;
    padding:11px 38px 11px 13px!important;
    border-radius:12px!important;
    margin:0!important;
    text-align:left!important;
  }
  #ppmView .ppmTaskCard > *:not(h4){
    display:none!important;
  }
  #ppmView .ppmTaskCard h4{
    display:block!important;
    margin:0!important;
    padding:0!important;
    font-size:15px!important;
    line-height:1.2!important;
    font-weight:800!important;
  }
  #ppmView .ppmTaskCard::before{
    content:attr(data-ppm);
    display:block;
    margin-bottom:3px;
    font-size:9px;
    line-height:1.1;
    font-weight:800;
    letter-spacing:.06em;
    opacity:.65;
  }
  #ppmView .ppmTaskCard::after{
    content:'›';
    position:absolute;
    right:14px;
    top:50%;
    transform:translateY(-50%);
    font-size:24px;
    line-height:1;
    opacity:.6;
  }
}
@media (max-width:360px){
  #ppmView .ppmDashboard{gap:6px!important;}
  #ppmView .ppmStat{padding:9px 10px!important;}
  #ppmView .ppmStat b{font-size:25px!important;}
  #ppmView .ppmTaskCard{padding:10px 34px 10px 11px!important;}
  #ppmView .ppmTaskCard h4{font-size:14px!important;}
}
`;
document.head.appendChild(style);
})();
