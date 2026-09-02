/* Spa PPM asset information helper. Lets engineers search Spa Plant Room assets and fill genuinely unknown fields without leaving the PPM page. */
(()=>{
'use strict';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();

let client=null;
let spaAssets=[];
let query='';
let showingAll=false;
let loading=false;

function isSpaPpmOpen(){
  const panel=$('ppmRegisterPanel');
  if(!panel || panel.hidden)return false;
  const title=norm($('ppmRoomTitle')?.textContent || $('ppmPageTitle')?.textContent || '');
  return title.includes('spa');
}

function missingFields(a){
  const miss=[];
  if(!String(a.manufacturer||'').trim())miss.push('manufacturer');
  if(!String(a.model||'').trim())miss.push('model');
  if(!String(a.serial_number||'').trim())miss.push('serial');
  if(!String(a.system_duty||'').trim() || norm(a.system_duty)==='spa plant equipment')miss.push('duty');
  return miss;
}

function ensureStyles(){
  if($('spaPpmUnknownStyles'))return;
  const style=document.createElement('style');
  style.id='spaPpmUnknownStyles';
  style.textContent=`
    .spaUnknownPanel{margin:14px 0 18px;background:#fff;border:1px solid #dbe3de;border-radius:16px;overflow:hidden;box-shadow:0 5px 16px #17372c0b}
    .spaUnknownHead{padding:14px;background:#f5f8f6;border-bottom:1px solid #e1e8e3;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .spaUnknownHead h4{margin:0;color:#17372c;font-size:16px}.spaUnknownHead p{margin:4px 0 0;color:#6e7771;font-size:12px;line-height:1.35}.spaUnknownCount{white-space:nowrap;background:#fff;border:1px solid #d8e1db;border-radius:999px;padding:6px 9px;color:#17372c;font-weight:900;font-size:11px}
    .spaUnknownTools{padding:10px;display:grid;grid-template-columns:1fr auto;gap:8px;border-bottom:1px solid #edf1ee}.spaUnknownTools input{min-height:42px;border:1px solid #cfd8d2;border-radius:11px;padding:9px 11px;width:100%;background:#fff}.spaUnknownTools button{border:1px solid #cfd8d2;border-radius:11px;background:#fff;color:#17372c;font-weight:900;padding:8px 11px}
    .spaUnknownList{display:grid;gap:8px;padding:10px}.spaUnknownCard{border:1px solid #dce4df;border-radius:13px;background:#fff;overflow:hidden}.spaUnknownSummary{width:100%;border:0;background:#fff;padding:11px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;text-align:left}.spaUnknownSummary:hover{background:#f8faf8}.spaUnknownCode{font-weight:950;color:#17372c;font-size:12px}.spaUnknownName{min-width:0}.spaUnknownName b{display:block;color:#25312b;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.spaUnknownName small{display:block;color:#77817b;margin-top:2px;font-size:10px}.spaUnknownBadge{background:#fff3cf;color:#755b0a;border-radius:999px;padding:5px 7px;font-size:9px;font-weight:900;text-transform:uppercase}.spaUnknownBadge.complete{background:#dceee2;color:#2b603b}
    .spaUnknownForm{display:none;border-top:1px solid #edf1ee;padding:11px;background:#fafcfa}.spaUnknownCard.open .spaUnknownForm{display:block}.spaUnknownGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.spaUnknownGrid label{display:grid;gap:4px;font-size:10px;font-weight:900;color:#56625b}.spaUnknownGrid input,.spaUnknownGrid textarea{border:1px solid #cfd8d2;border-radius:9px;padding:9px;background:#fff;min-width:0;font-size:13px}.spaUnknownWide{grid-column:1/-1}.spaUnknownActions{display:flex;align-items:center;gap:8px;margin-top:9px}.spaUnknownSave{border:0;border-radius:10px;padding:9px 12px;background:#17372c;color:#fff;font-weight:900}.spaUnknownMsg{font-size:11px;font-weight:800;color:#68736c}.spaUnknownMsg.ok{color:#2b603b}.spaUnknownMsg.error{color:#9a2c2c}.spaUnknownEmpty{padding:18px;text-align:center;color:#717b75;font-size:12px}
    @media(max-width:620px){.spaUnknownHead{padding:11px}.spaUnknownTools{grid-template-columns:1fr}.spaUnknownTools button{min-height:38px}.spaUnknownGrid{grid-template-columns:1fr}.spaUnknownWide{grid-column:auto}.spaUnknownList{padding:8px}.spaUnknownSummary{padding:9px}.spaUnknownBadge{font-size:8px}}
  `;
  document.head.appendChild(style);
}

function installPanel(){
  const register=$('ppmRegisterPanel');
  if(!register)return false;
  if($('spaPpmUnknownPanel'))return true;
  ensureStyles();

  const panel=document.createElement('section');
  panel.id='spaPpmUnknownPanel';
  panel.className='spaUnknownPanel';
  panel.hidden=true;
  panel.innerHTML=`
    <div class="spaUnknownHead">
      <div><h4>Asset information</h4><p>Search Spa Plant Room assets and fill in missing make, model, serial or duty information.</p></div>
      <span class="spaUnknownCount" id="spaUnknownCount">0 unknown</span>
    </div>
    <div class="spaUnknownTools">
      <input id="spaUnknownSearch" autocomplete="off" placeholder="Search asset code, name, manufacturer or model">
      <button id="spaUnknownToggle" type="button">Show all assets</button>
    </div>
    <div id="spaUnknownList" class="spaUnknownList"><div class="spaUnknownEmpty">Loading Spa assets…</div></div>`;

  const head=register.querySelector('.valveRegisterHead');
  if(head?.nextSibling)register.insertBefore(panel,head.nextSibling);
  else register.prepend(panel);

  $('spaUnknownSearch')?.addEventListener('input',e=>{query=e.target.value;render();});
  $('spaUnknownToggle')?.addEventListener('click',()=>{
    showingAll=!showingAll;
    $('spaUnknownToggle').textContent=showingAll?'Show missing only':'Show all assets';
    render();
  });
  $('spaUnknownList')?.addEventListener('click',handleListClick);
  return true;
}

function currentRows(){
  const q=norm(query);
  return spaAssets.filter(a=>{
    if(!showingAll && !missingFields(a).length)return false;
    if(!q)return true;
    return norm([a.asset_code,a.asset_name,a.manufacturer,a.model,a.serial_number,a.category,a.system_duty].join(' ')).includes(q);
  });
}

function render(){
  const panel=$('spaPpmUnknownPanel');
  if(!panel)return;
  panel.hidden=!isSpaPpmOpen();
  if(panel.hidden)return;

  const missingCount=spaAssets.filter(a=>missingFields(a).length).length;
  const count=$('spaUnknownCount');
  if(count)count.textContent=`${missingCount} unknown`;

  const host=$('spaUnknownList');
  if(!host)return;
  const rows=currentRows();
  if(!rows.length){host.innerHTML='<div class="spaUnknownEmpty">No matching assets.</div>';return;}

  host.innerHTML=rows.map(a=>{
    const miss=missingFields(a);
    const badge=miss.length?`${miss.length} missing`:'Complete';
    return `<article class="spaUnknownCard" data-spa-asset="${esc(a.id)}">
      <button type="button" class="spaUnknownSummary" data-spa-open="${esc(a.id)}">
        <span class="spaUnknownCode">${esc(a.asset_code)}</span>
        <span class="spaUnknownName"><b>${esc(a.asset_name)}</b><small>${esc([a.manufacturer,a.model].filter(Boolean).join(' · ')||miss.join(', '))}</small></span>
        <span class="spaUnknownBadge ${miss.length?'':'complete'}">${esc(badge)}</span>
      </button>
      <div class="spaUnknownForm">
        <div class="spaUnknownGrid">
          <label>Manufacturer<input data-field="manufacturer" value="${esc(a.manufacturer||'')}" placeholder="Unknown"></label>
          <label>Model<input data-field="model" value="${esc(a.model||'')}" placeholder="Unknown"></label>
          <label>Serial number<input data-field="serial_number" value="${esc(a.serial_number||'')}" placeholder="Unknown"></label>
          <label>Asset tag / local ref<input data-field="asset_tag" value="${esc(a.asset_tag||'')}" placeholder="Optional"></label>
          <label class="spaUnknownWide">System / duty<input data-field="system_duty" value="${esc(a.system_duty||'')}" placeholder="What does it serve?"></label>
          <label>Manufacturer page<input data-field="manufacturer_url" value="${esc(a.manufacturer_url||'')}" placeholder="https://…"></label>
          <label>Manual / technical data<input data-field="manual_url" value="${esc(a.manual_url||'')}" placeholder="https://…"></label>
          <label class="spaUnknownWide">Technical notes<textarea data-field="notes" rows="3" placeholder="Plate ratings, capacity, pressure, voltage, article number, etc.">${esc(a.notes||'')}</textarea></label>
        </div>
        <div class="spaUnknownActions"><button type="button" class="spaUnknownSave" data-spa-save="${esc(a.id)}">Save asset information</button><span class="spaUnknownMsg"></span></div>
      </div>
    </article>`;
  }).join('');
}

async function handleListClick(e){
  const open=e.target.closest('[data-spa-open]');
  if(open){
    const card=open.closest('.spaUnknownCard');
    card?.classList.toggle('open');
    return;
  }
  const save=e.target.closest('[data-spa-save]');
  if(!save)return;
  const card=save.closest('.spaUnknownCard');
  const id=save.dataset.spaSave;
  const existing=spaAssets.find(a=>a.id===id);
  if(!card||!existing)return;
  const msg=card.querySelector('.spaUnknownMsg');
  save.disabled=true;if(msg){msg.textContent='Saving…';msg.className='spaUnknownMsg';}
  try{
    const patch={};
    card.querySelectorAll('[data-field]').forEach(input=>{
      const field=input.dataset.field;
      const value=input.value.trim();
      const old=String(existing[field]??'').trim();
      if(value!==old)patch[field]=value||null;
    });
    if(!Object.keys(patch).length){if(msg){msg.textContent='No changes.';}return;}
    const {error}=await client.from('assets').update(patch).eq('id',id);
    if(error)throw error;
    Object.assign(existing,patch);
    if(msg){msg.textContent='Saved.';msg.className='spaUnknownMsg ok';}
    setTimeout(render,500);
  }catch(err){
    if(msg){msg.textContent=err?.message||'Save failed.';msg.className='spaUnknownMsg error';}
  }finally{save.disabled=false;}
}

async function loadSpaAssets(){
  if(loading)return;
  loading=true;
  try{
    const cfg=window.LIMEWOOD_CONFIG||{};
    if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
    client=client||window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const pr=await client.from('plant_rooms').select('id').ilike('name','Spa Plant Room').limit(1).maybeSingle();
    if(pr.error)throw pr.error;
    if(!pr.data?.id)return;
    const res=await client.from('assets').select('id,asset_code,asset_name,category,system_duty,manufacturer,model,serial_number,asset_tag,manufacturer_url,manual_url,notes,plant_room_id').eq('plant_room_id',pr.data.id).order('asset_code');
    if(res.error)throw res.error;
    spaAssets=res.data||[];
    render();
  }catch(err){
    const host=$('spaUnknownList');
    if(host)host.innerHTML=`<div class="spaUnknownEmpty">Could not load Spa assets: ${esc(err?.message||err)}</div>`;
  }finally{loading=false;}
}

function sync(){
  if(!installPanel())return;
  const panel=$('spaPpmUnknownPanel');
  if(panel)panel.hidden=!isSpaPpmOpen();
  if(isSpaPpmOpen() && !spaAssets.length)loadSpaAssets();
  else render();
}

function init(){
  if(!installPanel())return setTimeout(init,300);
  sync();
  const register=$('ppmRegisterPanel');
  const title=$('ppmRoomTitle');
  if(register)new MutationObserver(sync).observe(register,{attributes:true,attributeFilter:['hidden']});
  if(title)new MutationObserver(sync).observe(title,{childList:true,subtree:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
else setTimeout(init,0);
})();
