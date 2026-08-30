(() => {
  'use strict';
  function install(){
    if(!/\/staff-house-electrical\.html$/i.test(location.pathname)) return;
    document.querySelectorAll('.circuitNode[data-code]').forEach(el=>{
      if(el.dataset.directCircuitLink==='1') return;
      el.dataset.directCircuitLink='1';
      el.addEventListener('click',event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        const code=el.dataset.code;
        if(!code) return;
        location.href='/electrical-board-circuits.html?board='+encodeURIComponent(code);
      },true);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();