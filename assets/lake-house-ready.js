/* Lake House live-status layer.
   Lake House now exists in Supabase, so this helper keeps its dashboard tile
   current instead of showing the old hard-coded "Pending sync" placeholder. */
(() => {
  'use strict';

  const ROOM='Lake House Plant Room';
  const BUILDING='Lake House';
  const REFRESH_MS=30000;
  const cfg=window.LIMEWOOD_CONFIG||{};
  const liveClient=(window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey)
    ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
    : null;
  let live={ready:false,assets:0};
  let refreshing=false;

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
    let b=[...grid.querySelectorAll('[data-select-plant-room]')].find(x=>String(x.dataset.selectPlantRoom||'').toLowerCase()===ROOM.toLowerCase());
    if(!b){
      b=document.createElement('button');
      b.dataset.selectPlantRoom=ROOM;
      grid.appendChild(b);
    }
    b.innerHTML=`<span>🏭</span><b>Lake House</b><small>${live.assets} assets</small>`;
  }

  function addEstateTile(){
    const grid=document.querySelector('#dashboardView .estateGrid');
    if(!grid) return;
    let b=[...grid.querySelectorAll('[data-estate-room]')].find(x=>String(x.dataset.estateRoom||'').toLowerCase()===ROOM.toLowerCase());
    if(!b){
      b=document.createElement('button');
      b.dataset.estateRoom=ROOM;
      grid.appendChild(b);
    }
    b.innerHTML=live.ready
      ? `<div><b>Lake House</b><span>${live.assets} asset${live.assets===1?'':'s'}</span></div><strong>Live</strong>`
      : '<div><b>Lake House</b><span>Checking database…</span></div><strong class="amber">Checking</strong>';
  }

  function fixCount(){
    const rooms=new Set();
    document.querySelectorAll('#room option').forEach(o=>{
      const v=String(o.value||'').trim();
      if(/\bplant\s*room$/i.test(v)) rooms.add(v.toLowerCase());
    });
    if(live.ready) rooms.add(ROOM.toLowerCase());
    const metric=document.getElementById('metricPlantRoomCount');
    const quality=document.getElementById('roomsCount');
    if(metric) metric.textContent=String(rooms.size);
    if(quality) quality.textContent=String(rooms.size);
  }

  function render(){
    addRoomSelect();
    addNavRoom();
    addDirectoryRoom();
    addEstateTile();
    fixCount();
  }

  async function refreshLive(){
    if(!liveClient||refreshing) return;
    refreshing=true;
    try{
      const {data:building,error:bErr}=await liveClient.from('buildings').select('id,name').ilike('name',BUILDING).limit(1).maybeSingle();
      if(bErr) throw bErr;
      if(!building){ live={ready:false,assets:0}; render(); return; }
      const {data:room,error:rErr}=await liveClient.from('plant_rooms').select('id,name').eq('building_id',building.id).ilike('name',ROOM).limit(1).maybeSingle();
      if(rErr) throw rErr;
      if(!room){ live={ready:false,assets:0}; render(); return; }
      const {count,error:aErr}=await liveClient.from('assets').select('id',{count:'exact',head:true}).eq('plant_room_id',room.id);
      if(aErr) throw aErr;
      live={ready:true,assets:Number(count||0)};
      render();
    } catch(err){
      console.warn('Lake House live refresh failed:',err);
      render();
    } finally { refreshing=false; }
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

  function start(){
    render();
    refreshLive();
    setInterval(refreshLive,REFRESH_MS);
    window.addEventListener('focus',refreshLive);
    window.addEventListener('online',refreshLive);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshLive(); });
    const observer=new MutationObserver(()=>requestAnimationFrame(render));
    observer.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
