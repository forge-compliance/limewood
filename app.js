
let DB;
let deferredPrompt;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').hidden = false;
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').hidden = true;
});

async function init(){
  DB = await (await fetch('data/database.json')).json();
  const types = [...new Set(DB.assets.map(a=>a.equipment_type).filter(Boolean))].sort();
  const select = document.getElementById('typeFilter');
  types.forEach(t=>{
    const o=document.createElement('option');o.value=t;o.textContent=t;select.appendChild(o);
  });
  document.getElementById('search').addEventListener('input', render);
  select.addEventListener('change', render);
  document.getElementById('closeDialog').addEventListener('click',()=>document.getElementById('assetDialog').close());
  render();
}

function render(){
  const q=document.getElementById('search').value.toLowerCase().trim();
  const type=document.getElementById('typeFilter').value;
  const filtered=DB.assets.filter(a=>{
    const hay=[a.asset_id,a.equipment_type,a.manufacturer,a.model,a.serial_number,a.asset_tag_name].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!type||a.equipment_type===type);
  });
  document.getElementById('stats').innerHTML=`
    <div class="stat"><strong>${DB.assets.length}</strong><span>Total assets</span></div>
    <div class="stat"><strong>${filtered.length}</strong><span>Shown</span></div>
    <div class="stat"><strong>${DB.documents.length}</strong><span>Documents</span></div>`;
  const list=document.getElementById('assetList');
  list.innerHTML='';
  if(!filtered.length){list.innerHTML='<div class="empty">No matching assets.</div>';return;}
  filtered.forEach(a=>{
    const el=document.createElement('div');el.className='card';
    el.innerHTML=`<button>
      <div class="asset-id">${esc(a.asset_id)}</div>
      <div class="asset-title">${esc(a.asset_tag_name||a.equipment_type||'Asset')}</div>
      <div class="asset-meta">${esc(a.manufacturer||'Unknown')} · ${esc(a.model||'Unknown')}</div>
      <span class="badge">${esc(a.operational_status||'Status unknown')}</span>
    </button>`;
    el.querySelector('button').addEventListener('click',()=>openAsset(a.asset_id));
    list.appendChild(el);
  });
}

function openAsset(id){
  const a=DB.assets.find(x=>x.asset_id===id);
  const docIds=DB.asset_documents.filter(x=>x.asset_id===id).map(x=>x.document_id);
  const docs=DB.documents.filter(d=>docIds.includes(d.document_id));
  const fields=[
    ['Equipment',a.equipment_type],['Manufacturer',a.manufacturer],['Model',a.model],
    ['Serial number',a.serial_number],['Duty',a.service_duty],['Location',a.exact_location],
    ['Condition',a.condition],['Criticality',a.criticality],['PPM',a.ppm_frequency],
    ['Next service',a.next_service_due],['Isolation ref',a.isolation_reference],['BMS ref',a.bms_controls_reference]
  ];
  const saved=localStorage.getItem('note_'+id)||'';
  document.getElementById('assetDetail').innerHTML=`
    <h2>${esc(a.asset_id)}</h2>
    <p>${esc(a.asset_tag_name||a.equipment_type||'Asset')}</p>
    <div class="detail-grid">
      ${fields.map(([k,v])=>`<div class="detail-item"><small>${esc(k)}</small>${esc(v||'Unknown')}</div>`).join('')}
    </div>
    <h3>Documents</h3>
    <div class="docs">${docs.length?docs.map(d=>`<a href="${encodeURI(d.app_path)}" download>${esc(d.document_title)}</a>`).join(''):'No document linked.'}</div>
    <div class="notes">
      <h3>Mobile notes</h3>
      <textarea id="mobileNote" placeholder="Add a temporary note stored on this device">${esc(saved)}</textarea>
      <button onclick="saveNote('${escAttr(id)}')">Save note</button>
    </div>`;
  document.getElementById('assetDialog').showModal();
}
function saveNote(id){
  localStorage.setItem('note_'+id,document.getElementById('mobileNote').value);
  alert('Saved on this device.');
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function escAttr(v){return String(v??'').replace(/'/g,"\\'");}

if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js');}
init();
