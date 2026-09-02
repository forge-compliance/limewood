/* PPM directory UX: search first, buildings second. Keeps the existing PPM register/open-room logic intact. */
(()=>{
'use strict';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();

let client=null;
let buildings=[];
let plantRooms=[];
let areas=[];
let subAreas=[];
let assets=[];
let schedules=[];
let sourceRooms=[];
let selectedBuilding='';
let searchText='';

function roomNameFromAsset(a){
  const pr=plantRooms.find(p=>p.id===a.plant_room_id);
  if(pr?.name)return pr.name;
  const sub=subAreas.find(s=>s.id===a.sub_area_id);
  if(sub?.name)return sub.name;
  const area=areas.find(x=>x.id===a.area_id);
  if(area?.name)return area.name;
  return a.exact_location||'';
}

function buildingForAsset(a){
  if(a?.building_id)return a.building_id;
  const pr=plantRooms.find(p=>p.id===a?.plant_room_id);
  if(pr?.building_id)return pr.building_id;
  const area=areas.find(x=>x.id===a?.area_id);
  if(area?.building_id)return area.building_id;
  return '';
}

function buildingForRoom(room){
  const n=norm(room);
  const pr=plantRooms.find(p=>norm(p.name)===n);
  if(pr?.building_id)return pr.building_id;
  const ar=areas.find(a=>norm(a.name)===n);
  if(ar?.building_id)return ar.building_id;
  const sub=subAreas.find(s=>norm(s.name)===n);
  if(sub){
    const parent=areas.find(a=>a.id===sub.area_id);
    if(parent?.building_id)return parent.building_id;
  }
  const matches=assets.filter(a=>norm(roomNameFromAsset(a))===n || norm(a.exact_location)===n);
  const ids=[...new Set(matches.map(buildingForAsset).filter(Boolean))];
  return ids.length===1?ids[0]:'';
}

function scheduleSearchText(room){
  const n=norm(room);
  const roomAssets=assets.filter(a=>norm(roomNameFromAsset(a))===n || norm(a.exact_location)===n);
  const codes=new Set(roomAssets.map(a=>a.asset_code));
  const ppms=schedules.filter(s=>codes.has(s.asset_code));
  const buildingId=buildingForRoom(room);
  const building=buildings.find(b=>b.id===buildingId)?.name||'';
  return norm([
    room,building,
    ...roomAssets.flatMap(a=>[a.asset_code,a.asset_name,a.category,a.system_duty,a.manufacturer,a.model]),
    ...ppms.flatMap(s=>[s.asset_code,s.task,s.frequency,s.completion_status,s.notes])
  ].join(' '));
}

function installShell(){
  const panel=$('ppmDirectoryPanel');
  const picker=panel?.querySelector('.ppmRoomPicker');
  if(!panel||!picker)return false;
  if($('ppmSmartSearch'))return true;

  const search=document.createElement('section');
  search.className='ppmSmartSearch';
  search.id='ppmSmartSearch';
  search.innerHTML=`
    <div class="ppmSearchBox">
      <label for="ppmDirectorySearch">Search PPMs</label>
      <div class="ppmSearchRow">
        <span aria-hidden="true">⌕</span>
        <input id="ppmDirectorySearch" autocomplete="off" placeholder="Asset, code, building, plant room, task or frequency">
        <button id="ppmClearSearch" type="button" hidden>×</button>
      </div>
      <small id="ppmSearchHint">Search the whole PPM register, or choose a building below.</small>
    </div>`;
  panel.insertBefore(search,picker);

  const head=picker.querySelector('.sectionHead');
  if(head){
    head.querySelector('h3').textContent='Buildings';
    const span=head.querySelector('span');
    if(span)span.textContent='Choose a building to view its PPM locations';
  }

  const style=document.createElement('style');
  style.textContent=`
    .ppmSmartSearch{margin:16px 0 18px}.ppmSearchBox{background:linear-gradient(135deg,#17372c,#245544);border-radius:18px;padding:16px;box-shadow:0 8px 24px #17372c22;color:#fff}.ppmSearchBox label{display:block;font-weight:900;font-size:13px;margin-bottom:9px}.ppmSearchRow{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;background:#fff;border:1px solid #d7e0da;border-radius:14px;padding:0 10px;box-shadow:inset 0 1px 0 #fff}.ppmSearchRow span{font-size:25px;color:#466157;transform:rotate(-20deg)}.ppmSearchRow input{width:100%;min-height:50px;border:0!important;outline:0;background:transparent!important;padding:10px 2px!important;color:#25312b;font-size:16px}.ppmSearchRow button{width:34px;height:34px;border:0;border-radius:50%;background:#e9efeb;color:#17372c;font-size:22px;line-height:1}.ppmSearchBox small{display:block;margin-top:9px;color:#dfe8e2}.ppmBuildingGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ppmBuildingGrid button,.ppmLocationGrid button{min-height:70px;text-align:left;border:1px solid #dbe3de;border-radius:14px;background:#fff;padding:12px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 12px #17372c0c}.ppmBuildingGrid button span,.ppmLocationGrid button span{font-size:22px}.ppmBuildingGrid button b,.ppmLocationGrid button b{display:block;color:#17372c}.ppmBuildingGrid button small,.ppmLocationGrid button small{display:block;color:#6e7771;margin-top:3px}.ppmBuildingGrid button.active{border-color:#b99a4a;box-shadow:0 0 0 2px #b99a4a33}.ppmBrowserBack{grid-column:1/-1;min-height:44px!important;background:#eef3f0!important}.ppmSearchResultInfo{grid-column:1/-1;color:#6e7771;font-size:12px;padding:2px 2px 5px}.ppmLocationGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ppmNoResults{grid-column:1/-1;padding:24px;border:1px dashed #cbd6cf;border-radius:14px;text-align:center;color:#6e7771;background:#fff}@media(min-width:760px){.ppmBuildingGrid,.ppmLocationGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}`;
  document.head.appendChild(style);

  $('ppmDirectorySearch')?.addEventListener('input',e=>{
    searchText=e.target.value.trim();
    selectedBuilding='';
    $('ppmClearSearch').hidden=!searchText;
    renderSmartDirectory();
  });
  $('ppmClearSearch')?.addEventListener('click',()=>{
    searchText='';selectedBuilding='';
    const input=$('ppmDirectorySearch');if(input)input.value='';
    $('ppmClearSearch').hidden=true;
    renderSmartDirectory();
  });
  return true;
}

function isOurRender(host){
  return !!host.querySelector('[data-ppm-building],[data-ppm-building-back],.ppmSearchResultInfo,.ppmNoResults');
}

function captureOriginalRooms(){
  const host=$('ppmRoomButtons');
  if(!host||isOurRender(host))return false;
  const rows=[...host.querySelectorAll('[data-ppm-room]')].map(b=>({
    room:b.dataset.ppmRoom||'',
    html:b.innerHTML
  })).filter(x=>x.room);
  if(!rows.length)return false;
  sourceRooms=rows;
  return true;
}

function roomDetail(room){
  const src=sourceRooms.find(x=>x.room===room);
  if(!src)return '';
  const tmp=document.createElement('div');tmp.innerHTML=src.html;
  return tmp.querySelector('small')?.textContent||'';
}

function buildingCounts(){
  const counts=new Map();
  sourceRooms.forEach(x=>{
    const id=buildingForRoom(x.room);
    if(id)counts.set(id,(counts.get(id)||0)+1);
  });
  return counts;
}

function renderSmartDirectory(){
  const host=$('ppmRoomButtons');
  if(!host||!sourceRooms.length)return;

  if(searchText){
    const q=norm(searchText);
    const matches=sourceRooms.filter(x=>scheduleSearchText(x.room).includes(q));
    host.className='ppmLocationGrid';
    host.innerHTML=`<div class="ppmSearchResultInfo">${matches.length} matching location${matches.length===1?'':'s'}</div>`+
      (matches.length?matches.map(x=>`<button type="button" data-ppm-room="${esc(x.room)}"><span>🛠</span><div><b>${esc(x.room.replace(/ Plant Room$/i,''))}</b><small>${esc(roomDetail(x.room))}</small></div></button>`).join(''):`<div class="ppmNoResults">No PPMs match “${esc(searchText)}”.</div>`);
    const hint=$('ppmSearchHint');if(hint)hint.textContent='Search results update as you type. Tap a location to open its PPM schedule.';
    return;
  }

  if(selectedBuilding){
    const b=buildings.find(x=>x.id===selectedBuilding);
    const rooms=sourceRooms.filter(x=>buildingForRoom(x.room)===selectedBuilding);
    host.className='ppmLocationGrid';
    host.innerHTML=`<button type="button" class="ppmBrowserBack" data-ppm-building-back="1"><span>←</span><div><b>All buildings</b><small>${esc(b?.name||'Building')}</small></div></button>`+
      (rooms.length?rooms.map(x=>`<button type="button" data-ppm-room="${esc(x.room)}"><span>🛠</span><div><b>${esc(x.room.replace(/ Plant Room$/i,''))}</b><small>${esc(roomDetail(x.room))}</small></div></button>`).join(''):`<div class="ppmNoResults">No PPM locations are currently linked to this building.</div>`);
    const hint=$('ppmSearchHint');if(hint)hint.textContent=`Browsing ${b?.name||'building'} PPMs.`;
    return;
  }

  const counts=buildingCounts();
  const ordered=[...buildings].sort((a,b)=>a.name.localeCompare(b.name));
  host.className='ppmBuildingGrid';
  host.innerHTML=ordered.map(b=>`<button type="button" data-ppm-building="${esc(b.id)}"><span>🏨</span><div><b>${esc(b.name)}</b><small>${counts.get(b.id)||0} PPM location${(counts.get(b.id)||0)===1?'':'s'}</small></div></button>`).join('');
  const hint=$('ppmSearchHint');if(hint)hint.textContent='Search the whole PPM register, or choose a building below.';
}

async function loadReferenceData(){
  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
  client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const [b,p,a,sa,as,pp]=await Promise.all([
    client.from('buildings').select('id,name').order('name'),
    client.from('plant_rooms').select('id,name,building_id'),
    client.from('location_areas').select('id,name,building_id'),
    client.from('location_sub_areas').select('id,name,area_id'),
    client.from('assets').select('id,asset_code,asset_name,building_id,plant_room_id,area_id,sub_area_id,exact_location,category,system_duty,manufacturer,model'),
    client.from('ppm_schedules').select('asset_code,task,frequency,completion_status,notes')
  ]);
  buildings=b.data||[];plantRooms=p.data||[];areas=a.data||[];subAreas=sa.data||[];assets=as.data||[];schedules=pp.data||[];
  if(captureOriginalRooms())renderSmartDirectory();
}

function init(){
  if(!installShell())return setTimeout(init,300);
  const host=$('ppmRoomButtons');
  if(!host)return;

  // The core app renders the PPM room list when the PPM view opens. Observe only
  // that original render. Never respond to mutations produced by this enhancement,
  // otherwise the observer can recursively redraw the same DOM until the tab dies.
  const observer=new MutationObserver(()=>{
    if(isOurRender(host))return;
    if(captureOriginalRooms())renderSmartDirectory();
  });
  observer.observe(host,{childList:true,subtree:false});

  host.addEventListener('click',e=>{
    const building=e.target.closest('[data-ppm-building]');
    if(building){e.preventDefault();e.stopImmediatePropagation();selectedBuilding=building.dataset.ppmBuilding;renderSmartDirectory();return;}
    const back=e.target.closest('[data-ppm-building-back]');
    if(back){e.preventDefault();e.stopImmediatePropagation();selectedBuilding='';renderSmartDirectory();}
  },true);

  if(captureOriginalRooms())renderSmartDirectory();
  loadReferenceData().catch(err=>console.warn('PPM smart directory reference data:',err));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
else setTimeout(init,0);
})();
