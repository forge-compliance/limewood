/* PPM directory UX: Building -> group -> location, with global search. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
let client=null,buildings=[],groups=[],plantRooms=[],areas=[],subAreas=[],assets=[],schedules=[],sourceRooms=[];
let selectedBuilding='',selectedGroup='',searchText='';

function roomNameFromAsset(a){
 const pr=plantRooms.find(p=>p.id===a.plant_room_id);if(pr?.name)return pr.name;
 const sub=subAreas.find(s=>s.id===a.sub_area_id);if(sub?.name)return sub.name;
 const area=areas.find(x=>x.id===a.area_id);if(area?.name)return area.name;
 return a.exact_location||'';
}
function buildingForAsset(a){
 if(a?.building_id)return a.building_id;
 const pr=plantRooms.find(p=>p.id===a?.plant_room_id);if(pr?.building_id)return pr.building_id;
 const area=areas.find(x=>x.id===a?.area_id);if(area?.building_id)return area.building_id;
 return '';
}
function roomAssets(room){
 const n=norm(room);return assets.filter(a=>norm(roomNameFromAsset(a))===n||norm(a.exact_location)===n);
}
function buildingForRoom(room){
 const n=norm(room);
 const pr=plantRooms.find(p=>norm(p.name)===n);if(pr?.building_id)return pr.building_id;
 const ar=areas.find(a=>norm(a.name)===n);if(ar?.building_id)return ar.building_id;
 const sub=subAreas.find(s=>norm(s.name)===n);if(sub){const parent=areas.find(a=>a.id===sub.area_id);if(parent?.building_id)return parent.building_id;}
 const ids=[...new Set(roomAssets(room).map(buildingForAsset).filter(Boolean))];return ids.length===1?ids[0]:'';
}
function roomBelongsToGroup(room,g){
 if(!g)return false;
 const ras=roomAssets(room);
 if(ras.some(a=>a.location_group_id===g.id))return true;
 if(g.slug==='plant-rooms'){
   const n=norm(room);return plantRooms.some(p=>p.building_id===g.building_id&&norm(p.name)===n);
 }
 return false;
}
function groupRooms(g){return sourceRooms.filter(x=>buildingForRoom(x.room)===g.building_id&&roomBelongsToGroup(x.room,g));}
function scheduleSearchText(room){
 const ras=roomAssets(room),codes=new Set(ras.map(a=>a.asset_code)),ppms=schedules.filter(s=>codes.has(s.asset_code));
 const building=buildings.find(b=>b.id===buildingForRoom(room))?.name||'';
 const gs=groups.filter(g=>roomBelongsToGroup(room,g)).map(g=>g.name);
 return norm([room,building,...gs,...ras.flatMap(a=>[a.asset_code,a.asset_name,a.category,a.system_duty,a.manufacturer,a.model]),...ppms.flatMap(s=>[s.asset_code,s.task,s.frequency,s.completion_status,s.notes])].join(' '));
}
function iconForGroup(slug){return ({'plant-rooms':'🏭','air-conditioning':'❄️','kitchen':'🍽️','guest-rooms':'🛏️','public-areas':'🏨','service-areas':'🧰'})[slug]||'📍';}

function installShell(){
 const panel=$('ppmDirectoryPanel'),picker=panel?.querySelector('.ppmRoomPicker');if(!panel||!picker)return false;if($('ppmSmartSearch'))return true;
 const search=document.createElement('section');search.className='ppmSmartSearch';search.id='ppmSmartSearch';search.innerHTML=`<div class="ppmSearchBox"><label for="ppmDirectorySearch">Search PPMs</label><div class="ppmSearchRow"><span aria-hidden="true">⌕</span><input id="ppmDirectorySearch" autocomplete="off" placeholder="Asset, code, building, location, task or frequency"><button id="ppmClearSearch" type="button" hidden>×</button></div><small id="ppmSearchHint">Search the whole PPM register, or choose a building below.</small></div>`;panel.insertBefore(search,picker);
 const head=picker.querySelector('.sectionHead');if(head){head.querySelector('h3').textContent='Buildings';const span=head.querySelector('span');if(span)span.textContent='Choose a building to view its PPM sections';}
 const style=document.createElement('style');style.textContent=`.ppmSmartSearch{margin:12px 0}.ppmSearchBox{background:linear-gradient(135deg,#17372c,#245544);border-radius:15px;padding:12px;box-shadow:0 6px 18px #17372c1c;color:#fff}.ppmSearchBox label{display:block;font-weight:900;font-size:12px;margin-bottom:7px}.ppmSearchRow{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;background:#fff;border:1px solid #d7e0da;border-radius:11px;padding:0 8px}.ppmSearchRow span{font-size:20px;color:#466157;transform:rotate(-20deg)}.ppmSearchRow input{width:100%;min-height:42px;border:0!important;outline:0;background:transparent!important;padding:8px 1px!important;color:#25312b;font-size:14px}.ppmSearchRow button{width:30px;height:30px;border:0;border-radius:50%;background:#e9efeb;color:#17372c;font-size:19px}.ppmSearchBox small{display:block;margin-top:7px;color:#dfe8e2;font-size:11px}.ppmBuildingGrid,.ppmGroupGrid,.ppmLocationGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.ppmBuildingGrid button,.ppmGroupGrid button,.ppmLocationGrid button{min-height:48px;text-align:left;border:1px solid #dbe3de;border-radius:10px;background:#fff;padding:7px 8px;display:flex;gap:6px;align-items:center;box-shadow:0 2px 8px #17372c0a}.ppmBuildingGrid button span,.ppmGroupGrid button span,.ppmLocationGrid button span{font-size:16px;flex:0 0 auto}.ppmBuildingGrid button b,.ppmGroupGrid button b,.ppmLocationGrid button b{display:block;color:#17372c;font-size:12px;line-height:1.1}.ppmBuildingGrid button small,.ppmGroupGrid button small,.ppmLocationGrid button small{display:block;color:#6e7771;margin-top:2px;font-size:9px;line-height:1.1}.ppmBrowserBack{grid-column:1/-1;min-height:38px!important;background:#eef3f0!important}.ppmSearchResultInfo{grid-column:1/-1;color:#6e7771;font-size:11px;padding:1px 1px 3px}.ppmNoResults{grid-column:1/-1;padding:18px;border:1px dashed #cbd6cf;border-radius:12px;text-align:center;color:#6e7771;background:#fff;font-size:12px}@media(max-width:380px){.ppmBuildingGrid,.ppmGroupGrid,.ppmLocationGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:760px){.ppmBuildingGrid,.ppmGroupGrid,.ppmLocationGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}}`;document.head.appendChild(style);
 $('ppmDirectorySearch')?.addEventListener('input',e=>{searchText=e.target.value.trim();selectedBuilding='';selectedGroup='';$('ppmClearSearch').hidden=!searchText;renderSmartDirectory();});
 $('ppmClearSearch')?.addEventListener('click',()=>{searchText='';selectedBuilding='';selectedGroup='';const input=$('ppmDirectorySearch');if(input)input.value='';$('ppmClearSearch').hidden=true;renderSmartDirectory();});return true;
}
function isOurRender(host){return !!host.querySelector('[data-ppm-building],[data-ppm-group],[data-ppm-building-back],[data-ppm-group-back],.ppmSearchResultInfo,.ppmNoResults');}
function captureOriginalRooms(){
 const host=$('ppmRoomButtons');if(!host||isOurRender(host))return false;
 const rows=[...host.querySelectorAll('[data-ppm-room]')].map(b=>({room:b.dataset.ppmRoom||'',html:b.innerHTML})).filter(x=>x.room);if(!rows.length)return false;sourceRooms=rows;return true;
}
function roomDetail(room){const src=sourceRooms.find(x=>x.room===room);if(!src)return '';const tmp=document.createElement('div');tmp.innerHTML=src.html;return tmp.querySelector('small')?.textContent||'';}
function buildingCounts(){const counts=new Map();sourceRooms.forEach(x=>{const id=buildingForRoom(x.room);if(id)counts.set(id,(counts.get(id)||0)+1);});return counts;}
function locationButton(x){return `<button type="button" data-ppm-room="${esc(x.room)}"><span>🛠</span><div><b>${esc(x.room.replace(/ Plant Room$/i,''))}</b><small>${esc(roomDetail(x.room))}</small></div></button>`;}

function renderSmartDirectory(){
 const host=$('ppmRoomButtons');if(!host||!sourceRooms.length)return;
 if(searchText){
   const q=norm(searchText),matches=sourceRooms.filter(x=>scheduleSearchText(x.room).includes(q));host.className='ppmLocationGrid';host.innerHTML=`<div class="ppmSearchResultInfo">${matches.length} matching location${matches.length===1?'':'s'}</div>`+(matches.length?matches.map(locationButton).join(''):`<div class="ppmNoResults">No PPMs match “${esc(searchText)}”.</div>`);const hint=$('ppmSearchHint');if(hint)hint.textContent='Search results update as you type. Tap a location to open its PPM schedule.';return;
 }
 if(selectedBuilding&&selectedGroup){
   const b=buildings.find(x=>x.id===selectedBuilding),g=groups.find(x=>x.id===selectedGroup),rooms=g?groupRooms(g):[];host.className='ppmLocationGrid';host.innerHTML=`<button type="button" class="ppmBrowserBack" data-ppm-group-back="1"><span>←</span><div><b>${esc(b?.name||'Building')}</b><small>All PPM sections</small></div></button>`+(rooms.length?rooms.map(locationButton).join(''):`<div class="ppmNoResults">No PPM locations are currently linked to ${esc(g?.name||'this section')}.</div>`);const hint=$('ppmSearchHint');if(hint)hint.textContent=`Browsing ${b?.name||'building'} → ${g?.name||'section'}.`;return;
 }
 if(selectedBuilding){
   const b=buildings.find(x=>x.id===selectedBuilding),gs=groups.filter(g=>g.building_id===selectedBuilding).sort((a,b)=>(a.sort_order||100)-(b.sort_order||100)||a.name.localeCompare(b.name));
   if(gs.length){host.className='ppmGroupGrid';host.innerHTML=`<button type="button" class="ppmBrowserBack" data-ppm-building-back="1"><span>←</span><div><b>All buildings</b><small>${esc(b?.name||'Building')}</small></div></button>`+gs.map(g=>{const n=groupRooms(g).length;return `<button type="button" data-ppm-group="${esc(g.id)}"><span>${iconForGroup(g.slug)}</span><div><b>${esc(g.name)}</b><small>${n} PPM location${n===1?'':'s'}</small></div></button>`;}).join('');const hint=$('ppmSearchHint');if(hint)hint.textContent=`Choose a ${b?.name||'building'} PPM section.`;return;}
   const rooms=sourceRooms.filter(x=>buildingForRoom(x.room)===selectedBuilding);host.className='ppmLocationGrid';host.innerHTML=`<button type="button" class="ppmBrowserBack" data-ppm-building-back="1"><span>←</span><div><b>All buildings</b><small>${esc(b?.name||'Building')}</small></div></button>`+(rooms.length?rooms.map(locationButton).join(''):`<div class="ppmNoResults">No PPM locations are currently linked to this building.</div>`);return;
 }
 const counts=buildingCounts(),ordered=[...buildings].sort((a,b)=>a.name.localeCompare(b.name));host.className='ppmBuildingGrid';host.innerHTML=ordered.map(b=>`<button type="button" data-ppm-building="${esc(b.id)}"><span>🏨</span><div><b>${esc(b.name)}</b><small>${counts.get(b.id)||0} PPM location${(counts.get(b.id)||0)===1?'':'s'}</small></div></button>`).join('');const hint=$('ppmSearchHint');if(hint)hint.textContent='Search the whole PPM register, or choose a building below.';
}

async function loadReferenceData(){
 const cfg=window.LIMEWOOD_CONFIG||{};if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
 client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const [b,g,p,a,sa,as,pp]=await Promise.all([
  client.from('buildings').select('id,name').order('name'),
  client.from('location_groups').select('id,building_id,name,slug,sort_order').order('sort_order'),
  client.from('plant_rooms').select('id,name,building_id'),
  client.from('location_areas').select('id,name,building_id'),
  client.from('location_sub_areas').select('id,name,area_id'),
  client.from('assets').select('id,asset_code,asset_name,building_id,plant_room_id,area_id,sub_area_id,location_group_id,exact_location,category,system_duty,manufacturer,model'),
  client.from('ppm_schedules').select('asset_code,task,frequency,completion_status,notes')
 ]);
 buildings=b.data||[];groups=g.data||[];plantRooms=p.data||[];areas=a.data||[];subAreas=sa.data||[];assets=as.data||[];schedules=pp.data||[];
 if(!sourceRooms.length)captureOriginalRooms();if(sourceRooms.length)renderSmartDirectory();
}
function init(){
 if(!installShell())return setTimeout(init,300);const host=$('ppmRoomButtons');if(!host)return;
 const observer=new MutationObserver(()=>{if(isOurRender(host))return;if(captureOriginalRooms())renderSmartDirectory();});observer.observe(host,{childList:true,subtree:false});
 host.addEventListener('click',e=>{
  const building=e.target.closest('[data-ppm-building]');if(building){e.preventDefault();e.stopImmediatePropagation();selectedBuilding=building.dataset.ppmBuilding;selectedGroup='';renderSmartDirectory();return;}
  const group=e.target.closest('[data-ppm-group]');if(group){e.preventDefault();e.stopImmediatePropagation();selectedGroup=group.dataset.ppmGroup;renderSmartDirectory();return;}
  if(e.target.closest('[data-ppm-group-back]')){e.preventDefault();e.stopImmediatePropagation();selectedGroup='';renderSmartDirectory();return;}
  if(e.target.closest('[data-ppm-building-back]')){e.preventDefault();e.stopImmediatePropagation();selectedBuilding='';selectedGroup='';renderSmartDirectory();}
 },true);
 if(captureOriginalRooms())renderSmartDirectory();loadReferenceData().catch(err=>console.warn('PPM smart directory reference data:',err));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
