(async()=>{'use strict';
const requested=new URLSearchParams(location.search).get('building')||'Main House';
if(requested==='Barn'){location.replace('/barn-electrical.html?v=20260901-2');return}
if(requested==='Crescent'){location.replace('/crescent-electrical.html?v=20260901-1');return}
const cfg=window.LIMEWOOD_CONFIG||{};
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const natural=(a,b)=>String(a.asset_name||a.asset_code||'').localeCompare(String(b.asset_name||b.asset_code||''),undefined,{numeric:true,sensitivity:'base'});
const status=document.getElementById('status'),canvas=document.getElementById('canvas');
const [br,pr]=await Promise.all([sb.from('buildings').select('id,name').order('name'),sb.from('plant_rooms').select('id,name,building_id')]);
if(br.error||pr.error){status.textContent='Could not load building directory.';return}
const building=(br.data||[]).find(b=>b.name===requested)||(br.data||[])[0];
if(!building){status.textContent='No building found.';return}
document.getElementById('pageTitle').textContent=building.name+' Electrical';
const roomNames=(pr.data||[]).filter(r=>String(r.building_id)===String(building.id)).map(r=>r.name);
const roomNorms=new Set(roomNames.map(norm)),buildingNorm=norm(building.name);
const [ar,cr]=await Promise.all([
 sb.from('electrical_assets').select('asset_code,asset_name,plant_room,category,system_duty,distribution_board,upstream_supply,circuit_reference,verification_status').order('asset_code'),
 sb.from('electrical_circuits').select('board_asset_code,circuit_number,circuit_description,destination,phase,protective_device,device_rating,notes')
]);
if(ar.error){status.textContent='Could not load electrical assets.';return}
const all=(ar.data||[]).filter(a=>{const p=norm(a.plant_room);return roomNorms.has(p)||(buildingNorm&&p.includes(buildingNorm))});
const circuits=cr.error?[]:(cr.data||[]);
const structure=a=>/incoming|incomer|intake|meter|mains panel|main switch|switchboard|feeder|mcp|motor control|control panel|distribution board|consumer unit|\bcu\b|\bdb\b|dimmer|lighting control|emergency lighting|fire damper|ilight|unit mh/i.test((a.category||'')+' '+(a.asset_name||'')+' '+(a.system_duty||''));
const isFeederRecord=a=>/main switchboard feeder/i.test(a.category||'')||/^[A-Z]+-F-/i.test(a.asset_code||'');
const assets=all.filter(a=>structure(a)&&!isFeederRecord(a));
const circuitsFor=a=>{const keys=[a.asset_code,a.asset_name].filter(Boolean).map(norm);return circuits.filter(c=>keys.includes(norm(c.board_asset_code)))};
const incoming=assets.find(a=>/incoming|incomer|intake|meter|mains panel|main switchboard/.test(norm((a.category||'')+' '+(a.asset_name||''))))||null;
const txt=a=>norm((a.asset_name||'')+' '+(a.category||'')+' '+(a.system_duty||'')+' '+(a.asset_code||''));
const isConsumer=a=>/consumer unit|\bcu\b/.test(txt(a));
const isDimmerRack=a=>/dimmer|lighting control/.test(txt(a));
const isILight=a=>/\bilight\b/.test(txt(a))&&!isDimmerRack(a);
const isMCP=a=>/\bmcp\b|motor control panel/.test(txt(a));
const isEmergency=a=>/emergency lighting/.test(txt(a));
const isFire=a=>/fire damper|fsd damper/.test(txt(a));
const isControl=a=>/control panel/.test(txt(a))&&!isMCP(a)&&!isFire(a);
const isDB=a=>/distribution board|\bdb\b/.test(txt(a))&&!isConsumer(a)&&!isDimmerRack(a)&&!isMCP(a)&&!isFire(a)&&!isControl(a);
const isMain=a=>/switchboard|main switch|mains panel/.test(txt(a));
function itemCard(a){const ac=circuitsFor(a),n=ac.length,verified=/verified|human reviewed/.test(norm(a.verification_status)),href=a.asset_code?`/electrical-board-circuits.html?board=${encodeURIComponent(a.asset_code)}`:'#';const tag=n?n+' circuit'+(n===1?'':'s'):(verified?'Verified':'Recorded');const searchText=norm([a.asset_code,a.asset_name,a.plant_room,a.category,a.system_duty,a.distribution_board,a.upstream_supply,...ac.flatMap(c=>[c.circuit_number,c.circuit_description,c.destination,c.phase,c.protective_device,c.device_rating,c.notes])].join(' '));return `<a class="node mapItem${n?' hasCircuits':''}" data-search="${esc(searchText)}" href="${href}"><div class="code">${esc(a.asset_code||'')}</div><h3>${esc(a.asset_name||'Electrical asset')}</h3><p>${esc(a.plant_room||'Location not recorded')}</p><span class="pill">${esc(tag)}</span>${n?'<span class="pill">Open panel ›</span>':''}</a>`}
function groupCard(key,title,items){return `<div class="branchCell"><button class="groupBtn" type="button" data-group="${key}"><div class="code">${items.length} ITEMS</div><h3>${esc(title)}</h3><p>From main incomer</p><span class="pill">Open</span></button></div>`}
const remainder=assets.filter(a=>a!==incoming),used=new Set();
const take=(key,title,test)=>{const items=remainder.filter(a=>!used.has(a)&&test(a)).sort(natural);items.forEach(a=>used.add(a));return {key,title,items}};
const groups=[
 take('db','Distribution Boards',a=>isDB(a)),
 take('cu','Consumer Units',a=>isConsumer(a)),
 take('ilight','iLight Units',a=>isILight(a)),
 take('dimmers','Dimmer Racks & Lighting Control',a=>isDimmerRack(a)),
 take('mcp','Motor Control Panels',a=>isMCP(a)),
 take('emergency','Emergency Lighting',a=>isEmergency(a)),
 take('fire','Fire & Damper Controls',a=>isFire(a)),
 take('controls','Equipment Control Panels',a=>isControl(a)),
 take('main','Main Switchboards',a=>isMain(a)),
 take('other','Other Electrical Equipment',a=>true)
].filter(g=>g.items.length);
const sourceTitle=incoming?incoming.asset_name:'Incoming supply not yet registered',sourceCode=incoming?(incoming.asset_code||building.name.toUpperCase()):building.name.toUpperCase(),sourceSub=incoming?(incoming.plant_room||'Incoming electrical distribution'):'Upstream supply unconfirmed';
let html=`<div class="sourceWrap"><div class="sourceNode"><div class="code">${esc(sourceCode)}</div><h3>${esc(sourceTitle)}</h3><p>${esc(sourceSub)}</p></div></div><div class="trunk"></div><div class="bus"></div><div class="branchGrid">${groups.map(g=>groupCard(g.key,g.title,g.items)).join('')}</div>`;
html+=groups.map(g=>`<div id="group-${g.key}" class="groupPanel"><div class="groupTitle">${esc(g.title)}</div><div class="itemGrid">${g.items.map(itemCard).join('')}</div></div>`).join('');
html+='<div id="noMatches" class="noMatches">No electrical items match that search.</div>';
canvas.innerHTML=html;
canvas.querySelectorAll('.groupBtn').forEach(btn=>btn.addEventListener('click',()=>{const p=document.getElementById('group-'+btn.dataset.group);const open=p.classList.toggle('open');btn.querySelector('.pill').textContent=open?'Close':'Open';if(open)p.scrollIntoView({behavior:'smooth',block:'nearest'})}));
const search=document.getElementById('mapSearch');
search.addEventListener('input',()=>{const q=norm(search.value);let hits=0;canvas.querySelectorAll('.mapItem').forEach(el=>{const hit=!q||(el.dataset.search||'').includes(q);el.classList.toggle('hidden',!hit);if(hit)hits++});canvas.querySelectorAll('.groupPanel').forEach(p=>{const visible=[...p.querySelectorAll('.mapItem')].filter(x=>!x.classList.contains('hidden')).length;if(q&&visible)p.classList.add('open');else if(q&&!visible)p.classList.remove('open')});canvas.querySelectorAll('.groupBtn').forEach(btn=>{const p=document.getElementById('group-'+btn.dataset.group);const visible=p?[...p.querySelectorAll('.mapItem')].filter(x=>!x.classList.contains('hidden')).length:0;btn.closest('.branchCell').classList.toggle('hidden',!!q&&!visible)});document.getElementById('noMatches').style.display=q&&hits===0?'block':'none'});
status.hidden=true;canvas.hidden=false;
})();