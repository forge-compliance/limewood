/* Fallback PPM building browser. Only takes over when the smart directory has not rendered buildings. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let client,buildings=[],plantRooms=[],assets=[],schedules=[];

function roomForAsset(a){
  const pr=plantRooms.find(p=>p.id===a.plant_room_id);
  return pr?.name||a.exact_location||'';
}
function buildingForAsset(a){
  if(a.building_id)return a.building_id;
  return plantRooms.find(p=>p.id===a.plant_room_id)?.building_id||'';
}
function roomRows(){
  const scheduled=new Set(schedules.map(s=>s.asset_code).filter(Boolean));
  const map=new Map();
  assets.forEach(a=>{
    if(!scheduled.has(a.asset_code))return;
    const room=roomForAsset(a).trim();
    const building=buildingForAsset(a);
    if(!room||!building)return;
    const key=building+'|'+room;
    map.set(key,{building,room,count:(map.get(key)?.count||0)+1});
  });
  return [...map.values()].sort((a,b)=>a.room.localeCompare(b.room));
}
function renderBuildings(){
  const host=$('ppmRoomButtons');
  if(!host)return;
  if(host.querySelector('[data-ppm-building]'))return;
  const rows=roomRows();
  const counts=new Map();
  rows.forEach(r=>counts.set(r.building,(counts.get(r.building)||0)+1));
  host.className='ppmBuildingGrid';
  host.innerHTML=buildings.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(b=>`<button type="button" data-ppm-building-fallback="${esc(b.id)}"><span>🏨</span><div><b>${esc(b.name)}</b><small>${counts.get(b.id)||0} PPM location${(counts.get(b.id)||0)===1?'':'s'}</small></div></button>`).join('');
  const head=host.closest('.ppmRoomPicker')?.querySelector('.sectionHead h3');if(head)head.textContent='Buildings';
}
function renderRooms(buildingId){
  const host=$('ppmRoomButtons');if(!host)return;
  const b=buildings.find(x=>x.id===buildingId);
  const rows=roomRows().filter(r=>r.building===buildingId);
  host.className='ppmLocationGrid';
  host.innerHTML=`<button type="button" data-ppm-buildings-back="1" class="ppmBrowserBack"><span>←</span><div><b>All buildings</b><small>${esc(b?.name||'Building')}</small></div></button>`+
    (rows.length?rows.map(r=>`<button type="button" data-ppm-room="${esc(r.room)}"><span>🛠</span><div><b>${esc(r.room.replace(/ Plant Room$/i,''))}</b><small>${r.count} PPM${r.count===1?'':'s'}</small></div></button>`).join(''):`<div class="ppmNoResults">No PPM locations are linked to this building.</div>`);
}
async function init(){
  const host=$('ppmRoomButtons');if(!host)return setTimeout(init,300);
  await new Promise(r=>setTimeout(r,1200));
  if(host.querySelector('[data-ppm-building]'))return;
  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
  client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
  const [b,p,a,s]=await Promise.all([
    client.from('buildings').select('id,name').order('name'),
    client.from('plant_rooms').select('id,name,building_id'),
    client.from('assets').select('asset_code,building_id,plant_room_id,exact_location'),
    client.from('ppm_schedules').select('asset_code')
  ]);
  buildings=b.data||[];plantRooms=p.data||[];assets=a.data||[];schedules=s.data||[];
  renderBuildings();
  host.addEventListener('click',e=>{
    const building=e.target.closest('[data-ppm-building-fallback]');
    if(building){e.preventDefault();e.stopImmediatePropagation();renderRooms(building.dataset.ppmBuildingFallback);return;}
    const back=e.target.closest('[data-ppm-buildings-back]');
    if(back){e.preventDefault();e.stopImmediatePropagation();renderBuildings();}
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
