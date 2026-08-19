/* Lake House readiness layer.
   Makes Lake House Plant Room visible in the UI before Supabase creation is available.
   Once the real plant-room row exists, the normal live data will take over. */
(() => {
  'use strict';

  const ROOM='Lake House Plant Room';

  function addRoomSelect(){
    const select=document.getElementById('room');
    if(!select) return;
    if([...select.options].some(o=>String(o.value).toLowerCase()===ROOM.toLowerCase())) return;
    const o=document.createElement('option');
    o.value=ROOM;
    o.textContent=ROOM;
    select.appendChild(o);
  }

  function addNavRoom(){
    const nav=document.getElementById('plantRoomNav');
    if(!nav) return;
    if([...nav.querySelectorAll('button')].some(b=>String(b.dataset.room||b.dataset.hubRoom||'').toLowerCase()===ROOM.toLowerCase())) return;
    const b=document.createElement('button');
    b.type='button';
    b.dataset.room=ROOM;
    b.textContent='Lake House';
    nav.appendChild(b);
  }

  function addDirectoryRoom(){
    const grid=document.querySelector('.plantHubGrid.directoryGrid');
    if(!grid) return;
    if([...grid.querySelectorAll('[data-select-plant-room]')].some(b=>String(b.dataset.selectPlantRoom||'').toLowerCase()===ROOM.toLowerCase())) return;
    const b=document.createElement('button');
    b.dataset.selectPlantRoom=ROOM;
    b.innerHTML='<span>🏭</span><b>Lake House</b><small>0 assets · 0 valves</small>';
    grid.appendChild(b);
  }

  function addEstateTile(){
    const grid=document.querySelector('#dashboardView .estateGrid');
    if(!grid) return;
    if([...grid.querySelectorAll('[data-estate-room]')].some(b=>String(b.dataset.estateRoom||'').toLowerCase()===ROOM.toLowerCase())) return;
    const b=document.createElement('button');
    b.dataset.estateRoom=ROOM;
    b.innerHTML='<div><b>Lake House</b><span>Plant room ready</span></div><strong class="amber">Pending sync</strong>';
    grid.appendChild(b);
  }

  function fixCount(){
    const rooms=new Set();
    document.querySelectorAll('#room option').forEach(o=>{
      const v=String(o.value||'').trim();
      if(/\bplant\s*room$/i.test(v)) rooms.add(v.toLowerCase());
    });
    if(!rooms.has(ROOM.toLowerCase())) rooms.add(ROOM.toLowerCase());
    const metric=document.getElementById('metricPlantRoomCount');
    const quality=document.getElementById('roomsCount');
    if(metric) metric.textContent=String(rooms.size);
    if(quality) quality.textContent=String(rooms.size);
  }

  function run(){
    addRoomSelect();
    addNavRoom();
    addDirectoryRoom();
    addEstateTile();
    fixCount();
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-estate-room]');
    if(!b || b.dataset.estateRoom!==ROOM) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const roomBtn=document.querySelector(`[data-select-plant-room="${ROOM}"]`);
    if(roomBtn) roomBtn.click();
    else location.href='/?plantRoom='+encodeURIComponent(ROOM);
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(run));
  function start(){
    run();
    observer.observe(document.body,{subtree:true,childList:true});
    setTimeout(run,250);
    setTimeout(run,1000);
    setTimeout(run,2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
