/* Location-aware electrical schematic routing for verified plant rooms. */
(() => {
  'use strict';
  const norm=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();

  function contextText(el){
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
    return norm(parts.join(' '));
  }

  function isElectricalEntry(el){
    const text=norm([el.textContent,el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.dataset?.hubAction,el.getAttribute?.('href')].join(' '));
    return text.includes('electrical') || text.includes('distribution board') || text.includes('circuits & isolations');
  }

  function targetFor(el){
    const ctx=contextText(el);
    /* Main House must be checked first because some page-level text can also contain Staff House references. */
    if(ctx.includes('main house plant room')) return '/main-house-electrical.html';
    if(ctx.includes('staff house')) return '/staff-house-electrical.html';
    return '';
  }

  document.addEventListener('click',e=>{
    const el=e.target.closest('a,button,[role="button"],[data-hub-action]');
    if(!el || !isElectricalEntry(el)) return;
    const target=targetFor(el);
    if(!target || location.pathname===target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href=target;
  },true);
})();
