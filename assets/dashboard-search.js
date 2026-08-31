// Friendly, location-aware dashboard search for Limewood.
(() => {
  'use strict';

  const cfg=window.LIMEWOOD_CONFIG||{};
  let db=null;
  let directory=null;

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const norm=v=>String(v||'').trim().toLowerCase();

  function client(){
    if(db)return db;
    if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
    db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return db;
  }

  async function load(){
    if(directory)return directory;
    const c=client();
    if(!c)throw new Error('Search database is not ready.');
    const [b,p,a,s,x]=await Promise.all([
      c.from('buildings').select('id,name').order('name'),
      c.from('plant_rooms').select('id,building_id,name').order('name'),
      c.from('location_areas').select('id,building_id,name,area_type,active').order('name'),
      c.from('location_sub_areas').select('id,area_id,name,active').order('name'),
      c.from('assets').select('id,asset_code,asset_name,building_id,plant_room_id,area_id,sub_area_id,exact_location,category,manufacturer,model,serial_number,operational_status').order('asset_code')
    ]);
    const err=[b,p,a,s,x].find(r=>r.error)?.error;
    if(err)throw err;
    directory={
      buildings:b.data||[],
      plantRooms:p.data||[],
      areas:(a.data||[]).filter(r=>r.active!==false),
      subAreas:(s.data||[]).filter(r=>r.active!==false),
      assets:x.data||[]
    };
    return directory;
  }

  function locationText(asset,d){
    const building=d.buildings.find(x=>x.id===asset.building_id)?.name;
    const plant=d.plantRooms.find(x=>x.id===asset.plant_room_id)?.name;
    const area=d.areas.find(x=>x.id===asset.area_id)?.name;
    const sub=d.subAreas.find(x=>x.id===asset.sub_area_id)?.name;
    return [building,plant,area,sub,asset.exact_location].filter(Boolean).filter((v,i,arr)=>arr.indexOf(v)===i).join(' · ');
  }

  function host(){
    const view=document.getElementById('placeholderView');
    const card=view?.querySelector('.placeholderCard');
    if(!view||!card)return null;
    document.querySelectorAll('main > section').forEach(s=>s.hidden=true);
    view.hidden=false;
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawerBackdrop')?.classList.remove('open');
    card.classList.add('friendlySearchCard');
    return card;
  }

  function openAsset(code){
    const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('asset',code);location.href=u.toString();
  }

  function openPlantRoom(name){
    const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('plantRoom',name);location.href=u.toString();
  }

  function backDashboard(){
    const u=new URL(location.href);u.search='';u.hash='';location.href=u.toString();
  }

  function assetButton(a,d){
    const meta=[locationText(a,d),a.manufacturer,a.model].filter(Boolean).join(' · ');
    return `<button class="friendlySearchResult" data-fs-asset="${esc(a.asset_code)}"><span class="fsIcon">⚙️</span><span><b>${esc(a.asset_code)} · ${esc(a.asset_name)}</b><small>${esc(meta||'Asset record')}</small></span><strong>Open →</strong></button>`;
  }

  function locationMatches(q,d){
    const rows=[];
    d.buildings.forEach(x=>{if(norm(x.name).includes(q))rows.push({kind:'building',id:x.id,name:x.name,meta:'Building',icon:'🏨'});});
    d.plantRooms.forEach(x=>{if(norm(x.name).includes(q))rows.push({kind:'plant',id:x.id,name:x.name,meta:'Plant room',icon:'🏭'});});
    d.areas.forEach(x=>{
      const building=d.buildings.find(b=>b.id===x.building_id)?.name||'';
      if(norm(`${x.name} ${x.area_type||''} ${building}`).includes(q))rows.push({kind:'area',id:x.id,name:x.name,buildingId:x.building_id,meta:[building,x.area_type||'Area'].filter(Boolean).join(' · '),icon:'📍'});
    });
    d.subAreas.forEach(x=>{
      const area=d.areas.find(a=>a.id===x.area_id);
      const building=d.buildings.find(b=>b.id===area?.building_id)?.name||'';
      if(norm(`${x.name} ${area?.name||''} ${building}`).includes(q))rows.push({kind:'sub',id:x.id,name:x.name,areaId:x.area_id,meta:[building,area?.name,'Sub-area'].filter(Boolean).join(' · '),icon:'↳'});
    });
    return rows.slice(0,16);
  }

  function assetsForLocation(loc,d){
    if(loc.kind==='building')return d.assets.filter(a=>a.building_id===loc.id);
    if(loc.kind==='plant')return d.assets.filter(a=>a.plant_room_id===loc.id);
    if(loc.kind==='area')return d.assets.filter(a=>a.area_id===loc.id);
    if(loc.kind==='sub')return d.assets.filter(a=>a.sub_area_id===loc.id);
    return [];
  }

  function locationButton(loc,d){
    const count=assetsForLocation(loc,d).length;
    return `<button class="friendlySearchResult location" data-fs-location="${esc(loc.kind)}" data-fs-id="${esc(loc.id)}"><span class="fsIcon">${loc.icon}</span><span><b>${esc(loc.name)}</b><small>${esc(loc.meta)} · ${count} asset${count===1?'':'s'}</small></span><strong>Open →</strong></button>`;
  }

  function renderLocation(loc,d){
    if(loc.kind==='plant')return openPlantRoom(loc.name);
    const card=host();if(!card)return;
    const rows=assetsForLocation(loc,d).sort((a,b)=>String(a.asset_name||'').localeCompare(String(b.asset_name||''),undefined,{numeric:true,sensitivity:'base'}));
    const children=loc.kind==='building'
      ? d.areas.filter(a=>a.building_id===loc.id).map(a=>({kind:'area',id:a.id,name:a.name,buildingId:a.building_id,meta:a.area_type||'Area',icon:'📍'}))
      : loc.kind==='area'
        ? d.subAreas.filter(s=>s.area_id===loc.id).map(s=>({kind:'sub',id:s.id,name:s.name,areaId:s.area_id,meta:'Sub-area',icon:'↳'}))
        : [];
    card.innerHTML=`
      <span>ESTATE LOCATION</span>
      <h2>${esc(loc.name)}</h2>
      <p>${esc(loc.meta)}. Everything linked to this location is shown below.</p>
      ${children.length?`<div class="fsSection"><h3>Inside this location</h3><div class="fsResults">${children.map(x=>locationButton(x,d)).join('')}</div></div>`:''}
      <div class="fsSection"><h3>Equipment</h3><div class="fsResults">${rows.length?rows.map(a=>assetButton(a,d)).join(''):'<div class="fsEmpty">No assets are linked here yet.</div>'}</div></div>
      <button class="fsBack" data-fs-back>← Dashboard</button>`;
  }

  function assetMatches(q,d){
    return d.assets.filter(a=>norm([
      a.asset_code,a.asset_name,a.manufacturer,a.model,a.serial_number,a.category,a.exact_location,locationText(a,d)
    ].join(' ')).includes(q)).slice(0,16);
  }

  function renderSearch(query,d,locations){
    const card=host();if(!card)return;
    const assets=assetMatches(norm(query),d);
    card.innerHTML=`
      <span>SMART ESTATE SEARCH</span>
      <h2>Results for “${esc(query)}”</h2>
      <p>Search now understands where things live, not just what they are.</p>
      ${locations.length?`<div class="fsSection"><h3>📍 Locations</h3><div class="fsResults">${locations.map(x=>locationButton(x,d)).join('')}</div></div>`:''}
      ${assets.length?`<div class="fsSection"><h3>⚙️ Equipment</h3><div class="fsResults">${assets.map(a=>assetButton(a,d)).join('')}</div></div>`:''}
      ${!locations.length&&!assets.length?'<div class="fsEmpty"><b>No location or asset match found.</b><span>The normal Limewood search will still handle documents and valves.</span></div>':''}
      <button class="fsBack" data-fs-back>← Dashboard</button>`;
  }

  function makeFriendlier(){
    const input=document.getElementById('globalSearch');
    const label=document.querySelector('.dashboardSearch label');
    if(label)label.textContent='Find anything on the estate';
    if(input){
      input.placeholder='Try “Treatment Room 1”, “Raw & Cured”, “AC-010”, serial, model…';
      input.setAttribute('autocomplete','off');
    }
    const intro=document.querySelector('.dashboardIntro p');
    if(intro)intro.textContent='Type a room, building, asset ID, serial number, model or document. Limewood will take you to the right place.';
    const quick=document.querySelector('#quickEstateRegister small');
    if(quick)quick.textContent='Browse by plant room, building or area';

    if(!document.getElementById('friendlySearchStyles')){
      const style=document.createElement('style');
      style.id='friendlySearchStyles';
      style.textContent=`
        .friendlySearchCard{max-width:900px!important;text-align:left!important;width:min(900px,100%)}
        .friendlySearchCard>span,.friendlySearchCard>h2,.friendlySearchCard>p{text-align:center}
        .fsSection{margin:24px 0}.fsSection h3{font:22px Georgia;color:#17372c;margin:0 0 10px}
        .fsResults{display:grid;gap:9px}.friendlySearchResult{width:100%;display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;text-align:left!important;background:#f7f7f3!important;color:#17372c!important;border:1px solid #dfe5df!important;padding:13px 14px!important}
        .friendlySearchResult:hover{background:#edf3ee!important}.friendlySearchResult.location{background:#f3f7f4!important}
        .friendlySearchResult .fsIcon{font-size:22px;letter-spacing:0!important;color:inherit!important}.friendlySearchResult span:nth-child(2){letter-spacing:0!important;font-size:initial!important;color:inherit!important}.friendlySearchResult b{display:block;font-size:15px}.friendlySearchResult small{display:block;color:#69746d;margin-top:4px;font-weight:400}.friendlySearchResult strong{font-size:12px;white-space:nowrap;color:#8b6c1e}
        .fsEmpty{padding:24px;border-radius:12px;background:#f3f1eb;text-align:center;color:#68736c}.fsEmpty b,.fsEmpty span{display:block}.fsEmpty span{margin-top:5px;letter-spacing:0!important;color:#68736c!important;font-size:13px!important}
        .fsBack{display:block;margin:22px auto 0}
        .dashboardSearch input{min-width:0}
        @media(max-width:600px){.friendlySearchResult{grid-template-columns:36px 1fr}.friendlySearchResult strong{display:none}.friendlySearchCard{padding:22px!important}.dashboardSearch>div{display:grid!important;grid-template-columns:1fr auto}.dashboardSearch input{width:100%}}
      `;
      document.head.appendChild(style);
    }
  }

  async function warm(){
    try{await load();}catch(e){console.warn('Friendly search warm-up failed',e);}
  }

  function interceptSearch(e){
    const input=document.getElementById('globalSearch');
    if(!input||!directory)return;
    const query=input.value.trim();if(!query)return;
    const locations=locationMatches(norm(query),directory);
    if(!locations.length)return; // Existing Limewood search keeps handling non-location searches.
    e.preventDefault();e.stopImmediatePropagation();
    renderSearch(query,directory,locations);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#globalSearchBtn'))interceptSearch(e);

    const a=e.target.closest('[data-fs-asset]');
    if(a){e.preventDefault();e.stopImmediatePropagation();openAsset(a.dataset.fsAsset);return;}
    const locBtn=e.target.closest('[data-fs-location]');
    if(locBtn&&directory){
      e.preventDefault();e.stopImmediatePropagation();
      const kind=locBtn.dataset.fsLocation,id=locBtn.dataset.fsId;
      let loc=null;
      if(kind==='building'){const x=directory.buildings.find(r=>r.id===id);if(x)loc={kind,id,name:x.name,meta:'Building',icon:'🏨'};}
      if(kind==='plant'){const x=directory.plantRooms.find(r=>r.id===id);if(x)loc={kind,id,name:x.name,meta:'Plant room',icon:'🏭'};}
      if(kind==='area'){const x=directory.areas.find(r=>r.id===id);const b=directory.buildings.find(r=>r.id===x?.building_id);if(x)loc={kind,id,name:x.name,meta:[b?.name,x.area_type||'Area'].filter(Boolean).join(' · '),icon:'📍'};}
      if(kind==='sub'){const x=directory.subAreas.find(r=>r.id===id);const area=directory.areas.find(r=>r.id===x?.area_id);if(x)loc={kind,id,name:x.name,meta:[area?.name,'Sub-area'].filter(Boolean).join(' · '),icon:'↳'};}
      if(loc)renderLocation(loc,directory);
      return;
    }
    if(e.target.closest('[data-fs-back]')){e.preventDefault();e.stopImmediatePropagation();backDashboard();}
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target?.id==='globalSearch')interceptSearch(e);
  },true);

  window.addEventListener('load',()=>{makeFriendlier();setTimeout(warm,500);});
  if(document.readyState!=='loading'){makeFriendlier();setTimeout(warm,200);}
})();


/* ELECTRICAL_SMART_SEARCH_20260831 */
(() => {
  'use strict';

  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  let electrical=null, db=null;

  function roomNumber(raw){
    const s=norm(raw);
    let m=s.match(/\b(?:room|bedroom)\s*0*(\d{1,3})\b/);
    if(m)return String(Number(m[1]));
    m=s.match(/^mh\s*0*(\d{1,3})$/);
    return m?String(Number(m[1])):'';
  }

  function client(){
    if(db)return db;
    const cfg=window.LIMEWOOD_CONFIG||{};
    if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
    db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return db;
  }

  async function loadElectrical(){
    if(electrical)return electrical;
    const c=client(); if(!c)return null;
    const [ar,cr]=await Promise.all([
      c.from('electrical_assets').select('id,asset_code,asset_name,plant_room,category,system_duty,manufacturer,model,status,criticality,notes'),
      c.from('electrical_circuits').select('board_asset_code,circuit_number,circuit_description,destination,phase,protective_device,device_rating,status,notes')
    ]);
    if(ar.error||cr.error)throw ar.error||cr.error;
    electrical={assets:ar.data||[],circuits:cr.data||[]};
    return electrical;
  }

  function isGroupAsset(a,n){
    if(!n)return false;
    const code=String(a.asset_code||'').trim().toUpperCase();
    const rx=new RegExp('^MH-(?:DB|DIM)-0*'+n+'(?:[A-Z])?$','i');
    const text=norm([a.asset_name,a.system_duty,a.notes].join(' '));
    return rx.test(code) || text.includes('room '+n) || text.includes('bedroom '+n) || text.includes('dimmer '+n) || text.includes('mh'+n);
  }

  function circuitRoomHit(c,n){
    if(!n)return false;
    const text=norm([c.circuit_description,c.destination,c.notes].join(' '));
    return new RegExp('\\b(?:room|bedroom)\\s*0*'+n+'\\b','i').test(text);
  }

  function assetForCircuit(c,data){
    const key=norm(c.board_asset_code);
    return data.assets.find(a=>norm(a.asset_code)===key || norm(a.asset_name)===key) || null;
  }

  function searchElectrical(raw,data){
    const q=norm(raw), n=roomNumber(raw), map=new Map();
    const add=(a,reason,circuit)=>{
      if(!a)return;
      const row=map.get(a.id)||{asset:a,reasons:[],circuits:[]};
      if(reason&&!row.reasons.includes(reason))row.reasons.push(reason);
      if(circuit&&!row.circuits.includes(circuit))row.circuits.push(circuit);
      map.set(a.id,row);
    };

    data.assets.forEach(a=>{
      const direct=norm([a.asset_code,a.asset_name,a.plant_room,a.category,a.system_duty,a.manufacturer,a.model,a.status,a.notes].join(' ')).includes(q);
      if(direct)add(a,'Direct match');
      if(n&&isGroupAsset(a,n))add(a,'Room '+n+' electrical group');
    });

    data.circuits.forEach(c=>{
      const direct=norm([c.board_asset_code,c.circuit_number,c.circuit_description,c.destination,c.phase,c.protective_device,c.device_rating,c.status,c.notes].join(' ')).includes(q);
      const roomHit=n&&circuitRoomHit(c,n);
      const a=assetForCircuit(c,data);
      if((direct||roomHit)&&a)add(a,roomHit?'Supplies Room '+n:'Circuit match',c);
      if(n&&a&&isGroupAsset(a,n))add(a,'Room '+n+' electrical group',c);
    });

    return [...map.values()].sort((x,y)=>{
      const rank=r=>r.reasons.some(v=>v.startsWith('Supplies'))?0:r.reasons.includes('Direct match')?1:r.reasons.some(v=>v.includes('group'))?2:3;
      return rank(x)-rank(y) || String(x.asset.asset_name||'').localeCompare(String(y.asset.asset_name||''),undefined,{numeric:true});
    }).slice(0,24);
  }

  function host(){
    const view=document.getElementById('placeholderView');
    const card=view?.querySelector('.placeholderCard');
    if(!view||!card)return null;
    document.querySelectorAll('main > section').forEach(s=>s.hidden=true);
    view.hidden=false;
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawerBackdrop')?.classList.remove('open');
    card.classList.add('friendlySearchCard');
    return card;
  }

  function render(raw,rows){
    const card=host(); if(!card)return;
    card.innerHTML=`
      <span>SMART ESTATE SEARCH</span>
      <h2>Electrical results for “${esc(raw)}”</h2>
      <p>Verified boards, lighting controls and circuits linked to this search.</p>
      <div class="fsSection"><h3>⚡ Electrical</h3><div class="fsResults">
      ${rows.map(({asset:a,reasons,circuits})=>{
        const reason=reasons.find(r=>r.startsWith('Supplies'))||reasons.find(r=>r.includes('group'))||'Electrical match';
        const useful=circuits.filter(c=>norm(c.circuit_description||c.destination)!=='spare');
        const preview=useful.slice(0,3).map(c=>`<small>↳ ${esc([c.circuit_number,c.circuit_description||c.destination].filter(Boolean).join(' · '))}</small>`).join('');
        return `<button class="friendlySearchResult" data-smart-electrical="${esc(a.asset_code)}" data-smart-query="${esc(raw)}"><span class="fsIcon">⚡</span><span><b>${esc(a.asset_name||a.asset_code)}</b><small>${esc(a.plant_room||'Location to confirm')} · ${esc(a.category||'Electrical')}</small><small style="color:#8b6c1e">${esc(reason)}</small>${preview}${useful.length>3?`<small>+ ${useful.length-3} more related circuit${useful.length-3===1?'':'s'}</small>`:''}</span><strong>Open →</strong></button>`;
      }).join('')}
      </div></div>
      <button class="fsBack" data-fs-back>← Dashboard</button>`;
  }

  async function intercept(e){
    const input=document.getElementById('globalSearch');
    const raw=input?.value.trim(); if(!raw)return;
    try{
      const data=await loadElectrical(); if(!data)return;
      const rows=searchElectrical(raw,data);
      if(!rows.length)return;
      e.preventDefault(); e.stopImmediatePropagation();
      render(raw,rows);
    }catch(err){console.warn('Electrical smart search unavailable',err);}
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#globalSearchBtn'))intercept(e);
    const b=e.target.closest('[data-smart-electrical]');
    if(b){
      e.preventDefault(); e.stopImmediatePropagation();
      const u=new URL('/electrical-distribution.html',location.origin);
      u.searchParams.set('asset',b.dataset.smartElectrical);
      u.searchParams.set('search',b.dataset.smartQuery||b.dataset.smartElectrical);
      location.href=u.toString();
    }
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target?.id==='globalSearch')intercept(e);
  },true);

  window.addEventListener('load',()=>setTimeout(()=>loadElectrical().catch(()=>{}),700));
})();
