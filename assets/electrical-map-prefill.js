(()=>{'use strict';
  const apply=()=>{
    const q=new URLSearchParams(location.search).get('search')||'';
    if(!q)return;
    const input=document.getElementById('mapSearch');
    if(!input)return;
    input.value=q;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>{
      input.dispatchEvent(new Event('input',{bubbles:true}));
      const first=[...document.querySelectorAll('.mapItem')].find(el=>!el.classList.contains('hidden'));
      first?.scrollIntoView({behavior:'smooth',block:'center'});
    },250);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,300));else setTimeout(apply,300);
})();
