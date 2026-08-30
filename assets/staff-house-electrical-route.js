/* Location-aware electrical schematic routing for verified plant rooms. */
(() => {
  'use strict';
  const norm=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();

  function isElectricalEntry(el){
    const text=norm([el.textContent,el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.dataset?.hubAction,el.getAttribute?.('href')].join(' '));
    return text.includes('electrical') || text.includes('distribution board') || text.includes('circuits & isolations');
  }

  function exactPlantRoomTarget(){
    const title=norm(document.getElementById('hubRoomTitle')?.textContent||'');
    if(title.includes('main house') && title.includes('plant room')) return '/main-house-electrical.html';
    if(title.includes('staff house') && title.includes('plant room')) return '/staff-house-electrical.html';
    return '';
  }

  document.addEventListener('click',e=>{
    const el=e.target.closest('a,button,[role="button"],[data-hub-action]');
    if(!el || !isElectricalEntry(el)) return;

    const target=exactPlantRoomTarget();
    if(!target || location.pathname===target) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    location.href=target;
  },true);
})();
