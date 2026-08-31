// Universal smart search for Limewood Engineering.
(() => {
  'use strict';

  const cfg=window.LIMEWOOD_CONFIG||{};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  let db=null,data=null,busy=false;

  const aliases={
    plumbing:['plumbing','water','cws','hws','dhw','hot water','cold water','valve','pump','booster','tmv','drain','waste'],
    heating:['heating','boiler','lthw','radiator','calorifier','heat exchanger','pressurisation','underfloor','ufh'],
    lighting:['lighting','light','lights','dimmer','downlight','led','picture light'],
    sockets:['socket','sockets','ring main','power'],
    cooling:['cooling','air conditioning','air con','a c','fan coil','fcu','ahu','chilled water'],
    electrical:['electrical','distribution board','consumer unit','dimmer','circuit','mcb','rcbo','switchboard'],
    fire:['fire','alarm','smoke','sprinkler','emergency lighting','life safety'],
    spa:['spa','pool','hydro','lap pool','chlorine','bromine','filtration']
  };

  function client(){
    if(db)return db;
    if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
    db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return db;
  }

  function terms(raw){
    const q=norm(raw),out=new Set([q]);
    Object.entries(aliases).forEach(([k,list])=>{
      if(q===k||q.includes(k)||list.some(x=>q===norm(x))) list.forEach(x=>out.add(norm(x)));
    });
    return [...out].filter(Boolean);
  }

  function hit(values,ts){
    const h=norm(values.filter(v=>v!==null&&v!==undefined).join(' '));
    return ts.some(t=>h.includes(t));
  }

  function rank(values,raw){
    const h=norm(values.filter(Boolean).join(' ')),q=norm(raw);
    if(!q||!h)return 0;
    if(h===q)return 100;
    if(h.startsWith(q))return 80;
    if(h.includes(' '+q+' ')||h.endsWith(' '+q))return 70;
    if(h.includes(q))return 50;
    const ws=q.split(' ').filter(Boolean);
    return ws.length&&ws.every(w=>h.includes(w))?35:0;
  }

  function roomNumber(raw){
    const s=norm(raw);
    let m=s.match(/\b(?:room|bedroom)\s*0*(\d{1,3})\b/);
    if(m)return String(Number(m[1]));
    m=s.match(/^mh\s*0*(\d{1,3})$/);
    return m?String(Number(m[1])):'';
  }

  async function select(table,columns){
    const c=client(); if(!c)return [];
    const r=await c.from(table).select(columns);
    if(r.error){console.warn('Universal search skipped '+table,r.error.message);return [];}
    return r.data||[];
  }

  async function load(){
    if(data)return data;
    const [buildings,plantRooms,areas,subAreas,assets,valves,eAssets,eCircuits,assetDocs,sops,ppm,maintenance,logs]=await Promise.all([
      select('buildings','id,name,description,survey_status'),
      select('plant_rooms','id,building_id,name,description,survey_status'),
      select('location_areas','id,building_id,name,area_type,active,notes'),
      select('location_sub_areas','id,area_id,name,active,notes'),
      select('assets','id,asset_code,asset_name,building_id,plant_room_id,area_id,sub_area_id,exact_location,category,system_duty,manufacturer,model,serial_number,asset_tag,operational_status,condition,criticality,electrical_isolation,mechanical_isolation,emergency_isolation,ppm_frequency,last_service_date,next_service_date,notes'),
      select('valve_register','id,tag,plant_room,asset_code,service_duty,valve_type,size,normal_position,last_verified,location,isolation_purpose,notes'),
      select('electrical_assets','id,asset_code,asset_name,plant_room,category,system_duty,manufacturer,model,serial_number,status,condition,criticality,electrical_isolation,ppm_frequency,notes,distribution_board,circuit_reference,upstream_supply,phase,voltage,protective_device,device_rating,isolation_point'),
      select('electrical_circuits','id,board_asset_code,circuit_number,circuit_description,phase,protective_device,device_rating,destination,status,notes'),
      select('asset_documents','id,asset_id,title,document_type,storage_path,external_url,revision,created_at'),
      select('sops','id,sop_number,title,category,description,revision,status,author,approved_by,issue_date,review_date,building_id,plant_room_id,current_file_path,current_file_name,current_file_type'),
      select('ppm_schedules','id,asset_code,frequency,last_completed,next_due,assigned_to,completion_status,task,notes'),
      select('maintenance_records','id,asset_id,work_date,work_type,description,engineer_name,findings,actions_taken,follow_up_required,follow_up_date'),
      select('log_entries','id,log_type,location,plant_room,logged_at,logged_by_email,payload,status')
    ]);
    data={buildings,plantRooms,areas:areas.filter(x=>x.active!==false),subAreas:subAreas.filter(x=>x.active!==false),assets,valves,eAssets,eCircuits,assetDocs,sops,ppm,maintenance,logs};
    return data;
  }

  const buildingName=(id,d)=>d.buildings.find(x=>String(x.id)===String(id))?.name||'';
  const plantName=(id,d)=>d.plantRooms.find(x=>String(x.id)===String(id))?.name||'';
  const areaName=(id,d)=>d.areas.find(x=>String(x.id)===String(id))?.name||'';
  const subName=(id,d)=>d.subAreas.find(x=>String(x.id)===String(id))?.name||'';

  function assetLocation(a,d){
    return [buildingName(a.building_id,d),plantName(a.plant_room_id,d),areaName(a.area_id,d),subName(a.sub_area_id,d),a.exact_location]
      .filter(Boolean).filter((v,i,arr)=>arr.indexOf(v)===i).join(' · ');
  }

  function host(){
    const view=document.getElementById('placeholderView'),card=view?.querySelector('.placeholderCard');
    if(!view||!card)return null;
    document.querySelectorAll('main > section').forEach(s=>s.hidden=true);
    view.hidden=false;
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawerBackdrop')?.classList.remove('open');
    card.classList.add('friendlySearchCard','universalSearchCard');
    return card;
  }

  function locationRows(raw,d,ts){
    const out=[];
    d.buildings.forEach(x=>{const v=[x.name,x.description,x.survey_status];if(hit(v,ts))out.push({kind:'building',id:x.id,name:x.name,meta:'Building · '+(x.survey_status||'Status not set'),detail:x.description||'',rank:rank(v,raw)});});
    d.plantRooms.forEach(x=>{const b=buildingName(x.building_id,d),v=[x.name,x.description,x.survey_status,b];if(hit(v,ts))out.push({kind:'plant',id:x.id,name:x.name,meta:[b,'Plant room',x.survey_status].filter(Boolean).join(' · '),detail:x.description||'',rank:rank(v,raw)});});
    d.areas.forEach(x=>{const b=buildingName(x.building_id,d),v=[x.name,x.area_type,x.notes,b];if(hit(v,ts))out.push({kind:'area',id:x.id,name:x.name,meta:[b,x.area_type||'Area'].filter(Boolean).join(' · '),detail:x.notes||'',rank:rank(v,raw)});});
    d.subAreas.forEach(x=>{const a=d.areas.find(y=>String(y.id)===String(x.area_id)),b=buildingName(a?.building_id,d),v=[x.name,x.notes,a?.name,b];if(hit(v,ts))out.push({kind:'sub',id:x.id,name:x.name,meta:[b,a?.name,'Sub-area'].filter(Boolean).join(' · '),detail:x.notes||'',rank:rank(v,raw)});});
    return out.sort((a,b)=>b.rank-a.rank||a.name.localeCompare(b.name,undefined,{numeric:true})).slice(0,20);
  }

  function assetRows(raw,d,ts,locs){
    const ids=new Set(locs.map(x=>String(x.id)));
    return d.assets.map(a=>{
      const loc=assetLocation(a,d),v=[a.asset_code,a.asset_name,a.asset_tag,a.category,a.system_duty,a.manufacturer,a.model,a.serial_number,a.operational_status,a.condition,a.criticality,a.electrical_isolation,a.mechanical_isolation,a.emergency_isolation,a.ppm_frequency,a.notes,loc];
      const locHit=ids.has(String(a.building_id))||ids.has(String(a.plant_room_id))||ids.has(String(a.area_id))||ids.has(String(a.sub_area_id));
      if(!hit(v,ts)&&!locHit)return null;
      return {asset:a,loc,rank:Math.max(rank(v,raw),locHit?20:0)};
    }).filter(Boolean).sort((a,b)=>b.rank-a.rank||String(a.asset.asset_name||'').localeCompare(String(b.asset.asset_name||''),undefined,{numeric:true})).slice(0,30);
  }

  function valveRows(raw,d,ts,locs){
    const names=locs.map(x=>norm(x.name));
    return d.valves.map(v=>{
      const vals=[v.tag,v.plant_room,v.asset_code,v.service_duty,v.valve_type,v.size,v.normal_position,v.location,v.isolation_purpose,v.notes];
      const locHit=names.some(n=>n&&norm(v.plant_room).includes(n));
      if(!hit(vals,ts)&&!locHit)return null;
      return {valve:v,rank:Math.max(rank(vals,raw),locHit?20:0)};
    }).filter(Boolean).sort((a,b)=>b.rank-a.rank||String(a.valve.tag||'').localeCompare(String(b.valve.tag||''),undefined,{numeric:true})).slice(0,24);
  }

  function isGroup(a,n){
    if(!n)return false;
    const code=String(a.asset_code||'').trim().toUpperCase();
    const rx=new RegExp('^MH-(?:DB|DIM)-0*'+n+'(?:[A-Z])?$','i');
    const t=norm([a.asset_name,a.system_duty,a.notes].join(' '));
    return rx.test(code)||t.includes('room '+n)||t.includes('bedroom '+n)||t.includes('dimmer '+n)||t.includes('mh'+n);
  }

  function electricalRows(raw,d,ts){
    const n=roomNumber(raw),map=new Map();
    const add=(a,reason,c)=>{
      if(!a)return;
      const row=map.get(a.id)||{asset:a,reasons:[],circuits:[],rank:0};
      if(reason&&!row.reasons.includes(reason))row.reasons.push(reason);
      if(c&&!row.circuits.includes(c))row.circuits.push(c);
      row.rank=Math.max(row.rank,rank([a.asset_code,a.asset_name,a.plant_room,a.category,a.system_duty,a.manufacturer,a.model,a.serial_number,a.status,a.notes],raw));
      map.set(a.id,row);
    };
    d.eAssets.forEach(a=>{
      const vals=[a.asset_code,a.asset_name,a.plant_room,a.category,a.system_duty,a.manufacturer,a.model,a.serial_number,a.status,a.condition,a.criticality,a.electrical_isolation,a.notes,a.distribution_board,a.circuit_reference,a.upstream_supply,a.phase,a.voltage,a.protective_device,a.device_rating,a.isolation_point];
      if(hit(vals,ts))add(a,'Direct electrical match');
      if(n&&isGroup(a,n))add(a,'Room '+n+' electrical group');
    });
    d.eCircuits.forEach(c=>{
      const vals=[c.board_asset_code,c.circuit_number,c.circuit_description,c.destination,c.phase,c.protective_device,c.device_rating,c.status,c.notes];
      const rtext=norm([c.circuit_description,c.destination,c.notes].join(' '));
      const roomHit=n&&new RegExp('\\b(?:room|bedroom)\\s*0*'+n+'\\b','i').test(rtext);
      if(!hit(vals,ts)&&!roomHit)return;
      const key=norm(c.board_asset_code),a=d.eAssets.find(x=>norm(x.asset_code)===key||norm(x.asset_name)===key);
      if(a)add(a,roomHit?'Supplies Room '+n:'Circuit match',c);
    });
    if(n)d.eCircuits.forEach(c=>{const key=norm(c.board_asset_code),a=d.eAssets.find(x=>norm(x.asset_code)===key||norm(x.asset_name)===key);if(a&&isGroup(a,n))add(a,'Room '+n+' electrical group',c);});
    return [...map.values()].sort((a,b)=>{
      const rr=x=>x.reasons.some(y=>y.startsWith('Supplies'))?0:x.reasons.includes('Direct electrical match')?1:x.reasons.some(y=>y.includes('group'))?2:3;
      return rr(a)-rr(b)||b.rank-a.rank||String(a.asset.asset_name||'').localeCompare(String(b.asset.asset_name||''),undefined,{numeric:true});
    }).slice(0,30);
  }

  function documentRows(raw,d,ts,locs){
    const bIds=new Set(locs.filter(x=>x.kind==='building').map(x=>String(x.id)));
    const pIds=new Set(locs.filter(x=>x.kind==='plant').map(x=>String(x.id)));
    const out=[];
    d.assetDocs.forEach(x=>{
      const a=d.assets.find(y=>String(y.id)===String(x.asset_id)),v=[x.title,x.document_type,x.revision,a?.asset_code,a?.asset_name,a?assetLocation(a,d):''];
      if(hit(v,ts))out.push({title:x.title||'Document',type:x.document_type||'Document',meta:[x.revision?'Rev '+x.revision:'',a?.asset_name].filter(Boolean).join(' · '),detail:a?assetLocation(a,d):'',url:x.external_url||'',rank:rank(v,raw),kind:'document'});
    });
    d.sops.forEach(x=>{
      const b=buildingName(x.building_id,d),p=plantName(x.plant_room_id,d),v=[x.sop_number,x.title,x.category,x.description,x.revision,x.status,x.author,x.approved_by,b,p,x.current_file_name],locHit=bIds.has(String(x.building_id))||pIds.has(String(x.plant_room_id));
      if(hit(v,ts)||locHit)out.push({title:x.title||'SOP',type:'SOP',meta:[x.sop_number,x.revision?'Rev '+x.revision:'',x.status].filter(Boolean).join(' · '),detail:[b,p,x.description].filter(Boolean).join(' · '),url:'',rank:Math.max(rank(v,raw),locHit?20:0),kind:'sop'});
    });
    return out.sort((a,b)=>b.rank-a.rank||a.title.localeCompare(b.title,undefined,{numeric:true})).slice(0,24);
  }

  function ppmRows(raw,d,ts){
    return d.ppm.map(x=>{const a=d.assets.find(y=>norm(y.asset_code)===norm(x.asset_code)),v=[x.asset_code,x.frequency,x.assigned_to,x.completion_status,x.task,x.notes,a?.asset_name,a?assetLocation(a,d):''];if(!hit(v,ts))return null;return {ppm:x,asset:a,rank:rank(v,raw)};}).filter(Boolean).sort((a,b)=>b.rank-a.rank).slice(0,18);
  }

  function maintenanceRows(raw,d,ts){
    return d.maintenance.map(x=>{const a=d.assets.find(y=>String(y.id)===String(x.asset_id)),v=[x.work_date,x.work_type,x.description,x.engineer_name,x.findings,x.actions_taken,x.follow_up_date,a?.asset_code,a?.asset_name,a?assetLocation(a,d):''];if(!hit(v,ts))return null;return {record:x,asset:a,rank:rank(v,raw)};}).filter(Boolean).sort((a,b)=>b.rank-a.rank||String(b.record.work_date||'').localeCompare(String(a.record.work_date||''))).slice(0,18);
  }

  function logRows(raw,d,ts){
    return d.logs.map(x=>{const v=[x.log_type,x.location,x.plant_room,x.logged_at,x.logged_by_email,x.status,JSON.stringify(x.payload||{})];if(!hit(v,ts))return null;return {log:x,rank:rank(v,raw)};}).filter(Boolean).sort((a,b)=>b.rank-a.rank||String(b.log.logged_at||'').localeCompare(String(a.log.logged_at||''))).slice(0,14);
  }

  function button(icon,title,meta,detail,attrs,badge='Open →'){
    return `<button class="friendlySearchResult universalResult" ${attrs}><span class="fsIcon">${icon}</span><span><b>${esc(title)}</b><small>${esc(meta||'')}</small>${detail?`<small class="fsDetail">${esc(detail)}</small>`:''}</span><strong>${esc(badge)}</strong></button>`;
  }

  function section(title,html,count){return count?`<div class="fsSection"><h3>${title}<span class="fsCount">${count}</span></h3><div class="fsResults">${html}</div></div>`:'';}

  function render(raw,d){
    const ts=terms(raw),locs=locationRows(raw,d,ts),assets=assetRows(raw,d,ts,locs),valves=valveRows(raw,d,ts,locs),electrical=electricalRows(raw,d,ts),docs=documentRows(raw,d,ts,locs),ppm=ppmRows(raw,d,ts),maint=maintenanceRows(raw,d,ts),logs=logRows(raw,d,ts);
    const total=locs.length+assets.length+valves.length+electrical.length+docs.length+ppm.length+maint.length+logs.length;
    const card=host();if(!card)return;

    const locHtml=locs.map(x=>button(x.kind==='building'?'🏨':x.kind==='plant'?'🏭':'📍',x.name,x.meta,x.detail,`data-us-location="${esc(x.kind)}" data-us-id="${esc(x.id)}" data-us-name="${esc(x.name)}"`)).join('');
    const assetHtml=assets.map(({asset:a,loc})=>button('⚙️',a.asset_name||a.asset_code,[a.category,loc].filter(Boolean).join(' · '),[a.system_duty,a.manufacturer,a.model,a.operational_status].filter(Boolean).join(' · '),`data-us-asset="${esc(a.asset_code)}"`,a.criticality||'Open →')).join('');
    const valveHtml=valves.map(({valve:v})=>button('🚰',v.isolation_purpose||v.service_duty||v.tag||'Valve',[v.tag,v.plant_room,v.size,v.valve_type].filter(Boolean).join(' · '),[v.location,v.normal_position?'Normal: '+v.normal_position:''].filter(Boolean).join(' · '),`data-us-valve="${esc(v.id)}"`,v.normal_position||'Open →')).join('');
    const elecHtml=electrical.map(({asset:a,reasons,circuits})=>{const reason=reasons.find(x=>x.startsWith('Supplies'))||reasons.find(x=>x.includes('group'))||reasons[0]||'Electrical match',useful=circuits.filter(c=>norm(c.circuit_description||c.destination)!=='spare'),preview=useful.slice(0,3).map(c=>[c.circuit_number,c.circuit_description||c.destination].filter(Boolean).join(' · ')).join(' | ');return button('⚡',a.asset_name||a.asset_code,[a.category,a.plant_room].filter(Boolean).join(' · '),[reason,preview,useful.length>3?('+'+(useful.length-3)+' more circuits'):''].filter(Boolean).join(' · '),`data-us-electrical="${esc(a.asset_code)}" data-us-query="${esc(raw)}"`,circuits.length?circuits.length+' circuits':'Open →');}).join('');
    const docHtml=docs.map(x=>button(x.kind==='sop'?'📖':'📄',x.title,[x.type,x.meta].filter(Boolean).join(' · '),x.detail,`data-us-document="${esc(x.title)}" data-us-url="${esc(x.url||'')}"`)).join('');
    const ppmHtml=ppm.map(({ppm:p,asset:a})=>button('🛠️',p.task||((a?.asset_name||p.asset_code||'Asset')+' PPM'),[p.asset_code,p.frequency,p.completion_status].filter(Boolean).join(' · '),[p.next_due?'Next due '+p.next_due:'',p.assigned_to?'Assigned '+p.assigned_to:'',p.notes].filter(Boolean).join(' · '),`data-us-ppm="${esc(p.asset_code||p.task||raw)}"`,p.next_due||'Open →')).join('');
    const maintHtml=maint.map(({record:r,asset:a})=>button('🧰',r.description||r.work_type||'Maintenance record',[a?.asset_name,a?.asset_code,r.work_type,r.work_date].filter(Boolean).join(' · '),[r.findings,r.actions_taken,r.follow_up_required?'Follow-up required':''].filter(Boolean).join(' · '),a?.asset_code?`data-us-asset="${esc(a.asset_code)}"`:`data-us-maintenance="${esc(raw)}"`,r.work_date||'Open →')).join('');
    const logHtml=logs.map(({log:l})=>button('📝',l.log_type||'Log entry',[l.plant_room,l.location,l.status].filter(Boolean).join(' · '),[l.logged_at?new Date(l.logged_at).toLocaleString():'',l.logged_by_email].filter(Boolean).join(' · '),`data-us-log="${esc(l.log_type||raw)}"`)).join('');

    card.innerHTML=`
      <span>UNIVERSAL ESTATE SEARCH</span>
      <h2>Results for “${esc(raw)}”</h2>
      <p>${total} direct result${total===1?'':'s'} across the engineering database.</p>
      ${section('📍 Places',locHtml,locs.length)}
      ${section('⚙️ Assets · Heating · Plumbing · Plant',assetHtml,assets.length)}
      ${section('🚰 Valves & isolations',valveHtml,valves.length)}
      ${section('⚡ Electrical & circuits',elecHtml,electrical.length)}
      ${section('📚 Documents & SOPs',docHtml,docs.length)}
      ${section('🛠️ PPM schedules',ppmHtml,ppm.length)}
      ${section('🧰 Maintenance history',maintHtml,maint.length)}
      ${section('📝 Logs & checks',logHtml,logs.length)}
      ${!total?'<div class="fsEmpty"><b>No verified database match found.</b><span>Try a room, asset, valve duty, model, serial, circuit, document title or system name.</span></div>':''}
      <button class="fsBack" data-us-back>← Dashboard</button>`;
  }

  function makeFriendly(){
    const input=document.getElementById('globalSearch'),label=document.querySelector('.dashboardSearch label'),intro=document.querySelector('.dashboardIntro p');
    if(label)label.textContent='Search the whole estate';
    if(input){input.placeholder='Room, asset, valve, heating, plumbing, circuit, serial, SOP, PPM…';input.setAttribute('autocomplete','off');}
    if(intro)intro.textContent='One search for rooms, equipment, heating, plumbing, valves, electrical circuits, documents, maintenance and logs.';
    if(document.getElementById('universalSearchStyles'))return;
    const style=document.createElement('style');style.id='universalSearchStyles';style.textContent=`
      .friendlySearchCard{max-width:980px!important;text-align:left!important;width:min(980px,100%)}.friendlySearchCard>span,.friendlySearchCard>h2,.friendlySearchCard>p{text-align:center}
      .fsSection{margin:22px 0}.fsSection h3{font:20px Georgia;color:#17372c;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}.fsCount{font:700 11px Arial;background:#edf1ee;border-radius:999px;padding:5px 8px;color:#5e6a64}
      .fsResults{display:grid;gap:8px}.friendlySearchResult{width:100%;display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;text-align:left!important;background:#f7f7f3!important;color:#17372c!important;border:1px solid #dfe5df!important;padding:13px 14px!important;border-radius:12px}
      .friendlySearchResult:hover{background:#edf3ee!important}.friendlySearchResult .fsIcon{font-size:22px;letter-spacing:0!important;color:inherit!important}.friendlySearchResult span:nth-child(2){letter-spacing:0!important;font-size:initial!important;color:inherit!important}
      .friendlySearchResult b{display:block;font-size:15px}.friendlySearchResult small{display:block;color:#69746d;margin-top:3px;font-weight:400;line-height:1.35}.friendlySearchResult .fsDetail{color:#8b6c1e}.friendlySearchResult strong{font-size:11px;white-space:nowrap;color:#8b6c1e;max-width:110px;overflow:hidden;text-overflow:ellipsis}
      .fsEmpty{padding:24px;border-radius:12px;background:#f3f1eb;text-align:center;color:#68736c}.fsEmpty b,.fsEmpty span{display:block}.fsEmpty span{margin-top:5px;letter-spacing:0!important;color:#68736c!important;font-size:13px!important}.fsBack{display:block;margin:22px auto 0}.dashboardSearch input{min-width:0}
      @media(max-width:600px){.friendlySearchResult{grid-template-columns:34px 1fr;padding:12px!important}.friendlySearchResult strong{grid-column:2;font-size:9px}.friendlySearchCard{padding:18px!important}.dashboardSearch>div{display:grid!important;grid-template-columns:1fr auto}.dashboardSearch input{width:100%}}
    `;document.head.appendChild(style);
  }

  const dashboard=()=>{const u=new URL(location.href);u.search='';u.hash='';location.href=u.toString();};
  const openAsset=code=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('asset',code);location.href=u.toString();};
  const openPlant=name=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('plantRoom',name);location.href=u.toString();};
  function openValve(v){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('valve',v.tag||v.id);if(v.plant_room)u.searchParams.set('room',v.plant_room);location.href=u.toString();}
  function openElectrical(code,q){const u=new URL('/electrical-distribution.html',location.origin);u.searchParams.set('search',q||code);u.searchParams.set('asset',code);location.href=u.toString();}
  function openDocumentSearch(title){document.querySelector('[data-view="documents"]')?.click();setTimeout(()=>{const i=document.getElementById('documentSearch');if(i){i.value=title||'';i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}},100);}
  function openPpmSearch(term){document.getElementById('quickPpm')?.click();setTimeout(()=>{const i=document.getElementById('ppmSearch');if(i){i.value=term||'';i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}},100);}
  function openLogsSearch(term){document.getElementById('quickLogs')?.click();setTimeout(()=>{const i=document.getElementById('logHistorySearch');if(i){i.value=term||'';i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}},100);}

  async function run(e){
    const input=document.getElementById('globalSearch'),raw=input?.value.trim()||'';if(!raw)return;
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    if(busy)return;busy=true;
    try{render(raw,await load());}
    catch(err){console.warn('Universal search failed',err);const c=host();if(c)c.innerHTML='<span>SEARCH</span><h2>Search unavailable</h2><p>The database could not be read. Nothing has been changed.</p><button class="fsBack" data-us-back>← Dashboard</button>';}
    finally{busy=false;}
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#globalSearchBtn')){run(e);return;}
    const a=e.target.closest('[data-us-asset]');if(a){e.preventDefault();e.stopImmediatePropagation();openAsset(a.dataset.usAsset);return;}
    const v=e.target.closest('[data-us-valve]');if(v&&data){e.preventDefault();e.stopImmediatePropagation();const row=data.valves.find(x=>String(x.id)===String(v.dataset.usValve));if(row)openValve(row);return;}
    const el=e.target.closest('[data-us-electrical]');if(el){e.preventDefault();e.stopImmediatePropagation();openElectrical(el.dataset.usElectrical,el.dataset.usQuery);return;}
    const loc=e.target.closest('[data-us-location]');if(loc){e.preventDefault();e.stopImmediatePropagation();if(loc.dataset.usLocation==='plant')openPlant(loc.dataset.usName);else{const i=document.getElementById('globalSearch');if(i){i.value=loc.dataset.usName;run();}}return;}
    const doc=e.target.closest('[data-us-document]');if(doc){e.preventDefault();e.stopImmediatePropagation();if(doc.dataset.usUrl)location.href=doc.dataset.usUrl;else openDocumentSearch(doc.dataset.usDocument);return;}
    const p=e.target.closest('[data-us-ppm]');if(p){e.preventDefault();e.stopImmediatePropagation();openPpmSearch(p.dataset.usPpm);return;}
    const m=e.target.closest('[data-us-maintenance]');if(m){e.preventDefault();e.stopImmediatePropagation();location.href='/maintenance-dashboard.html';return;}
    const l=e.target.closest('[data-us-log]');if(l){e.preventDefault();e.stopImmediatePropagation();openLogsSearch(l.dataset.usLog);return;}
    if(e.target.closest('[data-us-back]')){e.preventDefault();e.stopImmediatePropagation();dashboard();}
  },true);

  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='globalSearch')run(e);},true);
  window.addEventListener('load',()=>{makeFriendly();setTimeout(()=>load().catch(()=>{}),500);});
  if(document.readyState!=='loading'){makeFriendly();setTimeout(()=>load().catch(()=>{}),180);}
})();