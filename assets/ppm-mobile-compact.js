/* Compact PPM dashboard cards on phones. */
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
}
@media (max-width:360px){
  #ppmView .ppmDashboard{gap:6px!important;}
  #ppmView .ppmStat{padding:9px 10px!important;}
  #ppmView .ppmStat b{font-size:25px!important;}
}
`;
document.head.appendChild(style);
})();
