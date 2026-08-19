// Limewood location-aware Asset Register navigation
// Keeps physical plant rooms, operational areas and HVAC registers distinct.
(() => {
  'use strict';

  const cfg = window.LIMEWOOD_CONFIG || {};
  let db = null;
  let cache = null;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'
  }[c]));

  function client(){
    if(db) return db;
    if(!window.supabase || !cfg.supabaseUrl || !cfg.supabasePublishableKey) return null;
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return db;
  }

  async function loadDirectory(force=false){
    if(cache && !force) return cache;
    const c=client();
    if(!c) throw new Error('Database connection is not ready.');

    const [b,p,a,s,x] = await Promise.all([
      c.from('buildings').select('id,name').order('name'),
      c.from('plant_rooms').select('id,building_id,name').order('name'),
      c.from('location_areas').select('id,building_id,name,area_type,active').order('sort_order').order('name'),
      c.from('location_sub_areas').select('id,area_id,name,active').order('sort_order').order('name'),
      c.from('assets').select('id,asset_code,asset_name,building_id,plant_room_id,area_id,sub_area_id,exact_location,category,manufacturer,model,operational_status').order('asset_code')
    ]);

    const err=[b,p,a,s,x].find(r=>r.error)?.error;
    if(err) throw err;

    cache={
      buildings:b.data||[],
      plantRooms:p.data||[],
      areas:(a.data||[]).filter(r=>r.active!==false),
      subAreas:(s.data||[]).filter(r=>r.active!==false),
      assets:x.data||[]
    };
    return cache;
  }

  function cardHost(){
    const view=document.getElementById('placeholderView');
    const card=view?.querySelector('.placeholderCard');
    if(!view || !card) return null;

    document.querySelectorAll('main > section').forEach(s=>s.hidden=true);
    view.hidden=false;
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawerBackdrop')?.classList.remove('open');
    return card;
  }

  function countText(n,label='asset'){
    return `${n} ${label}${n===1?'':'s'}`;
  }

  function setLoading(title='Asset Registers'){
    const card=cardHost();
    if(card) card.innerHTML=`<span>ASSET REGISTERS</span><h2>${esc(title)}</h2><p>Loading shared estate locations…</p>`;
  }

  function isHvacAsset(a){
    const hay=[a.category,a.asset_name,a.manufacturer,a.model]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes('air conditioning') || hay.includes('hvac') || /^ac-\d+/i.test(String(a.asset_code||''));
  }

  function locationLabel(a,d){
    const sub=d.subAreas.find(x=>x.id===a.sub_area_id);
    const area=d.areas.find(x=>x.id===a.area_id);
    const building=d.buildings.find(x=>x.id===a.building_id);
    const plant=d.plantRooms.find(x=>x.id===a.plant_room_id);
    return [building?.name, area?.name, sub?.name, plant?.name, a.exact_location]
      .filter(Boolean)
      .filter((v,i,arr)=>arr.indexOf(v)===i)
      .join(' · ') || 'Location to confirm';
  }

  async function showHome(){
    setLoading();
    const d=await loadDirectory();
    const card=cardHost();
    if(!card)return;

    const areaAssets=d.assets.filter(a=>a.area_id && !a.plant_room_id).length;
    const plantAssets=d.assets.filter(a=>a.plant_room_id).length;
    const hvacAssets=d.assets.filter(isHvacAsset).length;

    card.innerHTML=`
      <span>ASSET REGISTERS</span>
      <h2>Choose how to browse the estate</h2>
      <p>Plant rooms stay as engineering locations. Buildings contain operational areas such as bedrooms, treatment rooms, kitchens and cafés.</p>
      <div class="plantHubGrid directoryGrid">
        <button data-lw-register="plant-rooms"><span>🏭</span><b>Plant Rooms</b><small>${d.plantRooms.length} plant rooms · ${plantAssets} linked assets</small></button>
        <button data-lw-register="buildings"><span>🏨</span><b>Buildings & Areas</b><small>${d.buildings.length} buildings · ${d.areas.length} areas · ${areaAssets} area assets</small></button>
        <button data-lw-register="hvac"><span>❄️</span><b>Air Conditioning / HVAC</b><small>${hvacAssets} HVAC asset${hvacAssets===1?'':'s'}</small></button>
      </div>
      <button data-lw-register="all">Open estate asset register</button>`;
  }

  async function showHvac(){
    setLoading('Air Conditioning / HVAC');
    const d=await loadDirectory();
    const card=cardHost();
    if(!card)return;

    const rows=d.assets.filter(isHvacAsset).sort((a,b)=>{
      const la=locationLabel(a,d), lb=locationLabel(b,d);
      return la.localeCompare(lb,undefined,{numeric:true,sensitivity:'base'}) ||
        String(a.asset_code||'').localeCompare(String(b.asset_code||''),undefined,{numeric:true});
    });

    const grouped=new Map();
    for(const a of rows){
      const building=d.buildings.find(x=>x.id===a.building_id)?.name || 'Location to confirm';
      if(!grouped.has(building)) grouped.set(building,[]);
      grouped.get(building).push(a);
    }

    const sections=[...grouped.entries()].map(([building,list])=>`
      <section style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:8px">
          <h3 style="margin:0">${esc(building)}</h3>
          <small>${countText(list.length)}</small>
        </div>
        <div class="plantHubGrid directoryGrid">
          ${list.map(a=>{
            const loc=locationLabel(a,d);
            const spec=[a.manufacturer,a.model].filter(Boolean).join(' · ');
            return `<button data-lw-asset="${esc(a.asset_code)}"><span>❄️</span><b>${esc(a.asset_code)} · ${esc(a.asset_name)}</b><small>${esc(loc)}${spec?' · '+esc(spec):''}</small></button>`;
          }).join('')}
        </div>
      </section>`).join('');

    card.innerHTML=`
      <span>ASSET REGISTERS · HVAC</span>
      <h2>Air Conditioning / HVAC</h2>
      <p>${countText(rows.length)} across the estate. Open any unit for the full asset record, plate data, documents and photographs.</p>
      ${sections || '<p class="emptyState">No HVAC assets found.</p>'}
      <button data-lw-register="home">← Asset Registers</button>`;
  }

  async function showPlantRooms(){
    setLoading('Plant Rooms');
    const d=await loadDirectory();
    const card=cardHost();
    if(!card)return;

    card.innerHTML=`
      <span>ASSET REGISTERS · PLANT ROOMS</span>
      <h2>Select a plant room</h2>
      <p>These are the real plant-room records in Supabase. Areas are deliberately not included here.</p>
      <div class="plantHubGrid directoryGrid">
        ${d.plantRooms.map(r=>{
          const n=d.assets.filter(a=>a.plant_room_id===r.id).length;
          return `<button data-lw-plant="${esc(r.name)}"><span>🏭</span><b>${esc(r.name.replace(/ Plant Room$/i,''))}</b><small>${countText(n)}</small></button>`;
        }).join('') || '<p class="emptyState">No plant rooms found.</p>'}
      </div>
      <button data-lw-register="home">← Asset Registers</button>`;
  }

  async function showBuildings(){
    setLoading('Buildings & Areas');
    const d=await loadDirectory();
    const card=cardHost();
    if(!card)return;

    card.innerHTML=`
      <span>ASSET REGISTERS · BUILDINGS & AREAS</span>
      <h2>Select a building</h2>
      <p>Open a building, then choose the room or operational area.</p>
      <div class="plantHubGrid directoryGrid">
        ${d.buildings.map(b=>{
          const areas=d.areas.filter(a=>a.building_id===b.id);
          const assets=d.assets.filter(a=>a.building_id===b.id && a.area_id && !a.plant_room_id);
          return `<button data-lw-building="${esc(b.id)}"><span>🏨</span><b>${esc(b.name)}</b><small>${areas.length} area${areas.length===1?'':'s'} · ${countText(assets.length)}</small></button>`;
        }).join('') || '<p class="emptyState">No buildings found.</p>'}
      </div>
      <button data-lw-register="home">← Asset Registers</button>`;
  }

  async function showBuilding(buildingId){
    setLoading('Building Areas');
    const d=await loadDirectory();
    const b=d.buildings.find(x=>x.id===buildingId);
    const areas=d.areas.filter(a=>a.building_id===buildingId);
    const unassigned=d.assets.filter(a=>a.building_id===buildingId && !a.area_id && !a.plant_room_id);
    const card=cardHost();
    if(!card)return;

    card.innerHTML=`
      <span>BUILDINGS & AREAS</span>
      <h2>${esc(b?.name||'Building')}</h2>
      <p>Select an area to open the assets in that location.</p>
      <div class="plantHubGrid directoryGrid">
        ${areas.map(a=>{
          const n=d.assets.filter(x=>x.area_id===a.id && !x.plant_room_id).length;
          return `<button data-lw-area="${esc(a.id)}"><span>📍</span><b>${esc(a.name)}</b><small>${esc(a.area_type||'Area')} · ${countText(n)}</small></button>`;
        }).join('')}
        ${unassigned.length?`<button data-lw-unassigned="${esc(buildingId)}"><span>📦</span><b>Building assets</b><small>${countText(unassigned.length)} not assigned to an area</small></button>`:''}
        ${!areas.length&&!unassigned.length?'<p class="emptyState">No operational areas have been created in this building yet.</p>':''}
      </div>
      <button data-lw-register="buildings">← Buildings</button>`;
  }

  function assetButton(a){
    const meta=[a.manufacturer,a.model,a.exact_location].filter(Boolean).join(' · ');
    return `<button data-lw-asset="${esc(a.asset_code)}"><span>⚙️</span><b>${esc(a.asset_code)} · ${esc(a.asset_name)}</b><small>${esc(meta||a.category||'Asset record')}</small></button>`;
  }

  async function showArea(areaId){
    setLoading('Area Assets');
    const d=await loadDirectory();
    const area=d.areas.find(x=>x.id===areaId);
    const building=d.buildings.find(x=>x.id===area?.building_id);
    const subs=d.subAreas.filter(s=>s.area_id===areaId);
    const direct=d.assets.filter(a=>a.area_id===areaId && !a.sub_area_id && !a.plant_room_id);
    const card=cardHost();
    if(!card)return;

    const subHtml=subs.map(s=>{
      const n=d.assets.filter(a=>a.sub_area_id===s.id && !a.plant_room_id).length;
      return `<button data-lw-subarea="${esc(s.id)}"><span>↳</span><b>${esc(s.name)}</b><small>${countText(n)}</small></button>`;
    }).join('');

    card.innerHTML=`
      <span>${esc(building?.name||'BUILDING')} · AREA</span>
      <h2>${esc(area?.name||'Area')}</h2>
      <p>${esc(area?.area_type||'Operational area')} · ${countText(d.assets.filter(a=>a.area_id===areaId&&!a.plant_room_id).length)}</p>
      <div class="plantHubGrid directoryGrid">
        ${subHtml}
        ${direct.map(assetButton).join('')}
        ${!subHtml&&!direct.length?'<p class="emptyState">No assets have been assigned to this area yet.</p>':''}
      </div>
      <button data-lw-building="${esc(area?.building_id||'')}">← ${esc(building?.name||'Building')}</button>`;
  }

  async function showSubArea(subAreaId){
    const d=await loadDirectory();
    const sub=d.subAreas.find(x=>x.id===subAreaId);
    const area=d.areas.find(x=>x.id===sub?.area_id);
    const rows=d.assets.filter(a=>a.sub_area_id===subAreaId && !a.plant_room_id);
    const card=cardHost();
    if(!card)return;
    card.innerHTML=`<span>${esc(area?.name||'AREA')} · SUB-AREA</span><h2>${esc(sub?.name||'Sub-area')}</h2><p>${countText(rows.length)}</p><div class="plantHubGrid directoryGrid">${rows.map(assetButton).join('')||'<p class="emptyState">No assets assigned here yet.</p>'}</div><button data-lw-area="${esc(area?.id||'')}">← ${esc(area?.name||'Area')}</button>`;
  }

  async function showUnassigned(buildingId){
    const d=await loadDirectory();
    const b=d.buildings.find(x=>x.id===buildingId);
    const rows=d.assets.filter(a=>a.building_id===buildingId && !a.area_id && !a.plant_room_id);
    const card=cardHost();
    if(!card)return;
    card.innerHTML=`<span>${esc(b?.name||'BUILDING')}</span><h2>Building assets</h2><p>Assets linked to the building but not yet assigned to an area.</p><div class="plantHubGrid directoryGrid">${rows.map(assetButton).join('')||'<p class="emptyState">No unassigned assets.</p>'}</div><button data-lw-building="${esc(buildingId)}">← ${esc(b?.name||'Building')}</button>`;
  }

  function navigateAsset(code){
    const u=new URL(location.href);
    u.search='';
    u.hash='';
    u.searchParams.set('asset',code);
    location.href=u.toString();
  }

  function navigatePlantRoom(name){
    const u=new URL(location.href);
    u.search='';
    u.hash='';
    u.searchParams.set('plantRoom',name);
    location.href=u.toString();
  }

  async function syncPlantRoomCount(){
    try{
      const d=await loadDirectory(true);
      const n=d.plantRooms.length;
      const metric=document.getElementById('metricPlantRoomCount');
      const quality=document.getElementById('roomsCount');
      if(metric)metric.textContent=n;
      if(quality)quality.textContent=n;
    }catch(e){console.warn('Plant room count sync failed',e);}
  }

  function routeClick(e){
    const assetSummary=e.target.closest('#assetRegistersMenu > summary');
    const quick=e.target.closest('#quickEstateRegister,#metricAssets');
    if(assetSummary || quick){
      e.preventDefault();
      e.stopImmediatePropagation();
      showHome().catch(err=>alert(err.message));
      return;
    }

    const t=e.target.closest('[data-lw-register],[data-lw-plant],[data-lw-building],[data-lw-area],[data-lw-subarea],[data-lw-asset],[data-lw-unassigned]');
    if(!t)return;
    e.preventDefault();
    e.stopImmediatePropagation();

    if(t.dataset.lwRegister==='home') showHome();
    else if(t.dataset.lwRegister==='plant-rooms') showPlantRooms();
    else if(t.dataset.lwRegister==='buildings') showBuildings();
    else if(t.dataset.lwRegister==='hvac') showHvac();
    else if(t.dataset.lwRegister==='all'){
      const u=new URL(location.href); u.search=''; u.hash=''; location.href=u.toString();
    }
    else if(t.dataset.lwPlant) navigatePlantRoom(t.dataset.lwPlant);
    else if(t.dataset.lwBuilding) showBuilding(t.dataset.lwBuilding);
    else if(t.dataset.lwArea) showArea(t.dataset.lwArea);
    else if(t.dataset.lwSubarea) showSubArea(t.dataset.lwSubArea);
    else if(t.dataset.lwAsset) navigateAsset(t.dataset.lwAsset);
    else if(t.dataset.lwUnassigned) showUnassigned(t.dataset.lwUnassigned);
  }

  document.addEventListener('click',routeClick,true);
  window.addEventListener('load',()=>{
    setTimeout(syncPlantRoomCount,1200);
    document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(syncPlantRoomCount,1200));
  });
})();
