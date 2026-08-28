(()=>{
'use strict';

if(!/\/maintenance-dashboard\.html$/i.test(location.pathname)) return;

const cfg=window.LIMEWOOD_CONFIG||{};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitForPage(){
  for(let i=0;i<80;i++){
    if(window.supabase && $('assetId')) return true;
    await sleep(100);
  }
  return false;
}

async function start(){
  if(!await waitForPage()) return;
  const original=$('assetId');
  const label=original.closest('label');
  if(!label || $('assetPickerEnhanced')) return;

  const client=window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabasePublishableKey,
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
  );

  const [{data:sessionData},{data:profileData}]=await Promise.all([
    client.auth.getSession(),
    client.auth.getSession().then(async s=>{
      const uid=s.data.session?.user?.id;
      if(!uid) return {data:null};
      return client.from('profiles').select('role').eq('id',uid).maybeSingle();
    })
  ]);
  const session=sessionData.session;
  const role=profileData?.role||'viewer';
  const canManage=role==='admin'||role==='engineer';

  const style=document.createElement('style');
  style.textContent=`
    #assetPickerEnhanced{display:grid;gap:9px;margin-top:3px}
    .ap-row{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px}
    .ap-row input,.ap-row select{width:100%;min-height:42px}
    .ap-results{border:1px solid #d8e0db;border-radius:12px;max-height:260px;overflow:auto;background:#fff}
    .ap-result{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eef2ef;background:#fff;padding:10px 12px;color:#25312b}
    .ap-result:last-child{border-bottom:0}.ap-result:hover{background:#f3f7f4}
    .ap-result b{display:block;color:#17372c}.ap-result small{display:block;color:#6e7771;margin-top:3px}
    .ap-selected{background:#edf5ef;border:1px solid #cfe0d4;border-radius:11px;padding:10px 12px;font-size:12px;color:#2f4d3c}
    .ap-actions{display:flex;gap:8px;flex-wrap:wrap}.ap-actions button{border:0;border-radius:10px;padding:9px 11px;font-weight:800}
    .ap-create{background:#17372c;color:#fff}.ap-clear{background:#eef1ef;color:#46544c}
    .ap-empty{padding:15px;text-align:center;color:#758078;font-size:12px}
    #assetQuickModal{position:fixed;inset:0;background:#102018a8;display:none;align-items:center;justify-content:center;padding:18px;z-index:80}
    #assetQuickModal.open{display:flex}.aq-card{width:min(680px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:20px}
    .aq-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.aq-head h3{margin:3px 0 0;color:#17372c;font:700 23px Georgia}
    .aq-close{border:0;background:#eef1ef;border-radius:50%;width:38px;height:38px;font-size:22px}
    .aq-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.aq-grid label{margin:0}.aq-wide{grid-column:1/-1}
    .aq-msg{font-size:12px;font-weight:800;min-height:18px;margin-top:8px}.aq-msg.error{color:#9a2c2c}.aq-msg.ok{color:#2b603b}
    @media(max-width:700px){.ap-row,.aq-grid{grid-template-columns:1fr}.aq-wide{grid-column:auto}}
  `;
  document.head.appendChild(style);

  original.style.display='none';
  original.setAttribute('aria-hidden','true');

  const host=document.createElement('div');
  host.id='assetPickerEnhanced';
  host.innerHTML=`
    <div class="ap-row">
      <input id="apSearch" type="search" placeholder="Search asset name or number">
      <select id="apBuilding"><option value="">All buildings</option></select>
      <select id="apRoom"><option value="">All plant rooms / areas</option></select>
    </div>
    <div class="ap-row" style="grid-template-columns:1fr 1fr auto">
      <select id="apCategory"><option value="">All asset types</option></select>
      <select id="apSystem"><option value="">All systems / duties</option></select>
      <button type="button" id="apReset" class="ap-clear">Reset filters</button>
    </div>
    <div id="apSelected" class="ap-selected">No asset selected</div>
    <div id="apResults" class="ap-results"><div class="ap-empty">Loading assets…</div></div>
    <div class="ap-actions">
      ${canManage?'<button type="button" id="apCreate" class="ap-create">＋ Create new asset</button>':''}
      <button type="button" id="apClear" class="ap-clear">Clear selection</button>
    </div>
  `;
  label.appendChild(host);

  const modal=document.createElement('div');
  modal.id='assetQuickModal';
  modal.innerHTML=`
    <div class="aq-card">
      <div class="aq-head"><div><small>ASSET REGISTER</small><h3>Create new asset</h3></div><button type="button" class="aq-close" id="aqClose">×</button></div>
      <div class="aq-grid">
        <label>Asset number / code<input id="aqCode" placeholder="e.g. P-SPA-014"></label>
        <label>Asset name<input id="aqName" placeholder="e.g. Hydro pool circulation pump"></label>
        <label>Building<select id="aqBuilding"><option value="">Select building…</option></select></label>
        <label>Plant room / area<select id="aqRoom"><option value="">Select plant room / area…</option></select></label>
        <label>Asset type / category<input id="aqCategory" placeholder="e.g. Pump"></label>
        <label>System / duty<input id="aqSystem" placeholder="e.g. Hydro pool circulation"></label>
        <label class="aq-wide">Exact location<input id="aqLocation" placeholder="Optional location note"></label>
      </div>
      <div class="ap-actions" style="margin-top:14px"><button type="button" id="aqSave" class="ap-create">Create & select asset</button><button type="button" id="aqCancel" class="ap-clear">Cancel</button></div>
      <div id="aqMessage" class="aq-msg"></div>
    </div>`;
  document.body.appendChild(modal);

  const state={assets:[],buildings:[],rooms:[]};
  const byId=(rows,id)=>rows.find(x=>String(x.id)===String(id));
  const buildingName=id=>byId(state.buildings,id)?.name||'';
  const roomName=id=>byId(state.rooms,id)?.name||'';
  const labelFor=a=>`${a.asset_code||'Asset'} · ${a.asset_name||'Unnamed asset'}`;

  async function loadData(preselect=''){
    const [a,b,r]=await Promise.all([
      client.from('assets').select('id,asset_code,asset_name,building_id,plant_room_id,category,system_duty,manufacturer,model,exact_location').order('asset_code'),
      client.from('buildings').select('id,name').order('name'),
      client.from('plant_rooms').select('id,name,building_id').order('name')
    ]);
    const error=a.error||b.error||r.error;
    if(error){$('apResults').innerHTML=`<div class="ap-empty">${esc(error.message)}</div>`;return;}
    state.assets=a.data||[];state.buildings=b.data||[];state.rooms=r.data||[];
    fillFilters();
    const wanted=preselect||original.value;
    if(wanted) setSelected(wanted,false);
    renderResults();
  }

  function options(rows,allText){return `<option value="">${allText}</option>`+rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');}
  function fillFilters(){
    const b=$('apBuilding').value,r=$('apRoom').value,c=$('apCategory').value,s=$('apSystem').value;
    $('apBuilding').innerHTML=options(state.buildings,'All buildings');
    const rooms=state.rooms.filter(x=>!$('apBuilding').value||String(x.building_id)===String($('apBuilding').value));
    $('apRoom').innerHTML=options(rooms,'All plant rooms / areas');
    const cats=[...new Set(state.assets.map(a=>a.category).filter(Boolean))].sort();
    const systems=[...new Set(state.assets.map(a=>a.system_duty).filter(Boolean))].sort();
    $('apCategory').innerHTML='<option value="">All asset types</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join('');
    $('apSystem').innerHTML='<option value="">All systems / duties</option>'+systems.map(x=>`<option>${esc(x)}</option>`).join('');
    if([...$('apBuilding').options].some(o=>o.value===b))$('apBuilding').value=b;
    if([...$('apRoom').options].some(o=>o.value===r))$('apRoom').value=r;
    if([...$('apCategory').options].some(o=>o.value===c))$('apCategory').value=c;
    if([...$('apSystem').options].some(o=>o.value===s))$('apSystem').value=s;

    $('aqBuilding').innerHTML=options(state.buildings,'Select building…');
    $('aqRoom').innerHTML=options(state.rooms,'Select plant room / area…');
  }

  function filtered(){
    const q=$('apSearch').value.trim().toLowerCase(),b=$('apBuilding').value,r=$('apRoom').value,c=$('apCategory').value,s=$('apSystem').value;
    return state.assets.filter(a=>{
      const hay=[a.asset_code,a.asset_name,a.category,a.system_duty,a.manufacturer,a.model,a.exact_location,buildingName(a.building_id),roomName(a.plant_room_id)].filter(Boolean).join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!b||String(a.building_id)===b)&&(!r||String(a.plant_room_id)===r)&&(!c||a.category===c)&&(!s||a.system_duty===s);
    }).slice(0,80);
  }

  function renderResults(){
    const rows=filtered();
    $('apResults').innerHTML=rows.length?rows.map(a=>`<button type="button" class="ap-result" data-id="${esc(a.id)}"><b>${esc(labelFor(a))}</b><small>${esc([buildingName(a.building_id),roomName(a.plant_room_id),a.category,a.system_duty].filter(Boolean).join(' · ')||'Location not recorded')}</small></button>`).join(''):'<div class="ap-empty">No assets match those filters.</div>';
    $('apResults').querySelectorAll('.ap-result').forEach(b=>b.onclick=()=>setSelected(b.dataset.id));
  }

  function setSelected(id,notify=true){
    const asset=byId(state.assets,id);
    original.value=asset?String(asset.id):'';
    original.dispatchEvent(new Event('change',{bubbles:true}));
    $('apSelected').innerHTML=asset?`<b>${esc(labelFor(asset))}</b><br><small>${esc([buildingName(asset.building_id),roomName(asset.plant_room_id),asset.category].filter(Boolean).join(' · '))}</small>`:'No asset selected';
    if(asset&&notify) $('apResults').scrollTop=0;
  }

  function updateRoomsForBuilding(){
    const bid=$('apBuilding').value;
    const current=$('apRoom').value;
    const rooms=state.rooms.filter(x=>!bid||String(x.building_id)===bid);
    $('apRoom').innerHTML=options(rooms,'All plant rooms / areas');
    if([...$('apRoom').options].some(o=>o.value===current))$('apRoom').value=current;
    renderResults();
  }

  function openCreate(){
    $('aqCode').value='';$('aqName').value='';$('aqCategory').value=$('apCategory').value||'';$('aqSystem').value=$('apSystem').value||'';$('aqLocation').value='';
    $('aqBuilding').value=$('apBuilding').value||'';
    syncQuickRooms();
    $('aqRoom').value=$('apRoom').value||'';
    $('aqMessage').textContent='';$('aqMessage').className='aq-msg';
    modal.classList.add('open');$('aqCode').focus();
  }
  function closeCreate(){modal.classList.remove('open');}
  function syncQuickRooms(){
    const bid=$('aqBuilding').value,current=$('aqRoom').value;
    const rows=state.rooms.filter(x=>!bid||String(x.building_id)===bid);
    $('aqRoom').innerHTML=options(rows,'Select plant room / area…');
    if([...$('aqRoom').options].some(o=>o.value===current))$('aqRoom').value=current;
  }

  async function createAsset(){
    const code=$('aqCode').value.trim(),name=$('aqName').value.trim();
    if(!code||!name){$('aqMessage').textContent='Asset number and asset name are required.';$('aqMessage').className='aq-msg error';return;}
    const button=$('aqSave');button.disabled=true;$('aqMessage').textContent='Creating asset…';$('aqMessage').className='aq-msg';
    const payload={
      asset_code:code,
      asset_name:name,
      building_id:$('aqBuilding').value||null,
      plant_room_id:$('aqRoom').value||null,
      category:$('aqCategory').value.trim()||null,
      system_duty:$('aqSystem').value.trim()||null,
      exact_location:$('aqLocation').value.trim()||null,
      created_by:session?.user?.id||null,
      updated_by:session?.user?.id||null
    };
    const res=await client.from('assets').insert(payload).select('id').single();
    if(res.error){$('aqMessage').textContent=res.error.message;$('aqMessage').className='aq-msg error';button.disabled=false;return;}
    await loadData(res.data.id);
    setSelected(res.data.id);
    closeCreate();
    button.disabled=false;
  }

  ['apSearch','apCategory','apSystem'].forEach(id=>$(id).addEventListener(id==='apSearch'?'input':'change',renderResults));
  $('apBuilding').addEventListener('change',updateRoomsForBuilding);
  $('apRoom').addEventListener('change',renderResults);
  $('apReset').onclick=()=>{$('apSearch').value='';$('apBuilding').value='';updateRoomsForBuilding();$('apRoom').value='';$('apCategory').value='';$('apSystem').value='';renderResults();};
  $('apClear').onclick=()=>setSelected('');
  if($('apCreate'))$('apCreate').onclick=openCreate;
  $('aqClose').onclick=closeCreate;$('aqCancel').onclick=closeCreate;
  $('aqBuilding').onchange=syncQuickRooms;$('aqSave').onclick=createAsset;
  modal.addEventListener('click',e=>{if(e.target===modal)closeCreate();});

  // The original page rebuilds the hidden select after refresh/save. Keep the enhanced picker in sync.
  const observer=new MutationObserver(()=>{
    const value=original.value;
    if(value && state.assets.length) setSelected(value,false);
  });
  observer.observe(original,{childList:true});

  await loadData();
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
