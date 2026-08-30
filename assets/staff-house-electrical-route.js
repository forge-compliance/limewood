/* Global Staff House electrical route. Any Staff House electrical entry point goes to the verified schematic. */
(() => {
  'use strict';
  const target='/staff-house-electrical.html';
  const norm=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
  function isStaffHouseContext(el){
    const parts=[];
    let n=el;
    for(let i=0;n&&i<6;i++,n=n.parentElement){
      parts.push(n.textContent||'');
      parts.push(n.getAttribute?.('data-building')||'');
      parts.push(n.getAttribute?.('data-room')||'');
      parts.push(n.getAttribute?.('data-location')||'');
      parts.push(n.getAttribute?.('aria-label')||'');
    }
    parts.push(document.getElementById('hubRoomTitle')?.textContent||'');
    parts.push(document.querySelector('[data-current-building]')?.textContent||'');
    return norm(parts.join(' ')).includes('staff house');
  }
  function isElectricalEntry(el){
    const text=norm([el.textContent,el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.dataset?.hubAction,el.getAttribute?.('href')].join(' '));
    return text.includes('electrical') || text.includes('distribution board') || text.includes('circuits & isolations');
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('a,button,[role="button"],[data-hub-action]');
    if(!el || location.pathname===target) return;
    if(isElectricalEntry(el) && isStaffHouseContext(el)){
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href=target;
    }
  },true);
})();
