(() => {
'use strict';

const cfg = window.LIMEWOOD_CONFIG || {};
const bmsCfg = window.LIMEWOOD_BMS || {baseUrl:'https://192.168.170.100',readOnly:true};
const bmsRoutes = {
  overview:'/ord/station:|slot:/Graphics',
  main:'/ord/station:|slot:/Graphics/Main_House',
  staff:'/ord/station:|slot:/Graphics/Staff_House|view:Staff%20House',
  coach:'/ord/station:|slot:/Graphics/Coach_House',
  spa:'/ord/station:|slot:/Graphics/Spa',
  green:'/ord/station:|slot:/Graphics/Green_Barn',
  crescent:'/ord/station:|slot:/Graphics/The_Crescent',
  pavilion:'/ord/station:|slot:/Graphics/Pavilion',
  oil:'/ord/station:|slot:/Graphics/Oil_System'
};
const staticBase = Array.isArray(window.LIMEWOOD_ASSETS) ? window.LIMEWOOD_ASSETS : [];
const staticByCode = new Map(staticBase.map(a => [a.id, a]));
const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const fields = [
  ['name','Asset name'],['room','Plant room'],['category','Category'],['system','System / duty'],
  ['manufacturer','Manufacturer'],['model','Model'],['serial','Serial number'],['condition','Condition'],
  ['criticality','Criticality'],['electricalIsolation','Electrical isolation'],['mechanicalIsolation','Mechanical isolation'],
  ['isolationProcedure','Isolation procedure'],['ppm','PPM frequency']
];

const els = {
  authScreen:$('authScreen'), appShell:$('appShell'), authEmail:$('authEmail'), authPassword:$('authPassword'),
  authMessage:$('authMessage'), signIn:$('signInBtn'), signUp:$('signUpBtn'), signOut:$('signOutBtn'), refresh:$('refreshBtn'),
  sync:$('syncStatus'), grid:$('grid'), search:$('search'), room:$('room'), category:$('category'), completeness:$('completeness'),
  totalCount:$('totalCount'), roomsCount:$('roomsCount'), surveyedCount:$('surveyedCount'), reviewCount:$('reviewCount'),
  photoCount:$('photoCount'), resultCount:$('resultCount'), modal:$('modal'), modalId:$('mId'), modalName:$('mName'),
  modalDetails:$('mDetails'), modalNotes:$('mNotes'), modalStatus:$('mStatus'), save:$('saveBtn'), close:document.querySelector('.close'),
  previous:$('prevBtn'), next:$('nextBtn'), back:$('backBtn'), edit:$('editBtn'), editPanel:$('editPanel'),
  editFields:$('editFields'), manufacturerLink:$('mManufacturerLink'), manualLink:$('mManualLink'), photos:$('mPhotos'),
  docTitle:$('mDocTitle'), docType:$('mDocType'), document:$('mDocument'), gallery:$('photoGallery'), links:$('assetLinks'),
  addAsset:$('addAssetBtn'), assetBmsBtn:$('assetBmsBtn'), assetQrBtn:$('assetQrBtn'), missingCount:$('missingCount'), criticalCount:$('criticalCount'), dashboardDocumentCount:$('dashboardDocumentCount'), qualityPercent:$('qualityPercent'), recentActivity:$('recentActivity'), globalSearch:$('globalSearch')
};

const docEls = {
  view:$('documentView'), title:$('documentViewTitle'), grid:$('documentGrid'), count:$('documentCount'),
  search:$('documentSearch'), typeFilter:$('documentTypeFilter'), buildingFilter:$('documentBuildingFilter'), statusFilter:$('documentStatusFilter'),
  add:$('addDocumentBtn'), modal:$('documentModal'), close:$('closeDocumentModal'), save:$('saveDocumentBtn'), message:$('documentUploadMessage'),
  type:$('dType'), number:$('dNumber'), docTitle:$('dTitle'), category:$('dCategory'), revision:$('dRevision'), status:$('dStatus'),
  author:$('dAuthor'), approvedBy:$('dApprovedBy'), issueDate:$('dIssueDate'), reviewDate:$('dReviewDate'), building:$('dBuilding'),
  plantRoom:$('dPlantRoom'), asset:$('dAsset'), description:$('dDescription'), changeSummary:$('dChangeSummary'), file:$('dFile')
};

let session = null;
let assets = [];
let buildings = [];
let plantRooms = [];
let current = null;
let visibleRows = [];
let editing = false;
let libraryDocuments = [];
let sopRecords = [];
let documentTypeContext = '';


function bmsKeyForRoom(room='') {
  const r=String(room).toLowerCase();
  if(r.includes('staff')) return 'staff';
  if(r.includes('main')) return 'main';
  if(r.includes('coach')) return 'coach';
  if(r.includes('spa')) return 'spa';
  if(r.includes('green')) return 'green';
  if(r.includes('crescent')) return 'crescent';
  if(r.includes('pavilion')) return 'pavilion';
  return 'overview';
}
function bmsUrl(key='overview') { return `${String(bmsCfg.baseUrl||'').replace(/\/$/,'')}${bmsRoutes[key]||bmsRoutes.overview}`; }
function openBms(key='overview') {
  const url=bmsUrl(key);
  if(!url) return alert('The BMS address has not been configured.');
  window.open(url,'_blank','noopener');
}


const complianceRegisters = [
  {key:'fire',icon:'🚨',title:'Fire & life safety',terms:['fire','emergency lighting','alarm','sprinkler'],category:'Fire & Life Safety'},
  {key:'water',icon:'💧',title:'Water hygiene',terms:['legionella','water hygiene','temperature','sampling','tmv'],category:'Water Hygiene'},
  {key:'electrical',icon:'⚡',title:'Electrical safety',terms:['eicr','pat','electrical','fixed wire','distribution board'],category:'Electrical'},
  {key:'gas',icon:'🔥',title:'Gas, oil & combustion',terms:['gas','oil','combustion','boiler service','flue'],category:'Gas & Combustion'},
  {key:'pressure',icon:'🧯',title:'Pressure systems',terms:['pressure','written scheme','expansion vessel','pressurisation'],category:'Pressure Systems'},
  {key:'lifting',icon:'🏗️',title:'Lifting equipment',terms:['loler','lift','hoist','lifting'],category:'LOLER'},
  {key:'fgas',icon:'❄️',title:'F-Gas & refrigeration',terms:['f-gas','fgas','refrigerant','leak check'],category:'F-Gas'},
  {key:'asbestos',icon:'🧱',title:'Asbestos management',terms:['asbestos','refurbishment survey'],category:'Asbestos'},
  {key:'coshh',icon:'🧪',title:'COSHH & chemicals',terms:['coshh','chemical','safety data'],category:'COSHH'},
  {key:'work',icon:'🛠️',title:'PUWER & work equipment',terms:['puwer','work equipment','inspection'],category:'PUWER'}
];
function assetUrl(code){ const u=new URL(location.href); u.search=''; u.hash=''; u.searchParams.set('asset',code); return u.toString(); }
function matchingComplianceDocs(register){ return libraryDocuments.filter(d=>{const h=[d.title,d.number,d.category,d.type,d.raw?.description].join(' ').toLowerCase();return register.terms.some(t=>h.includes(t));}); }
function complianceDue(d){ const raw=d.raw||{}; const date=raw.review_date||raw.expiry_date||raw.next_review_date||''; if(!date)return false; return new Date(date).getTime() <= Date.now()+60*86400000; }
function renderCompliance(){
  const grid=$('complianceGrid'), evidence=$('complianceEvidenceList'); if(!grid||!evidence)return;
  const allMatches=new Map(); complianceRegisters.forEach(r=>matchingComplianceDocs(r).forEach(d=>allMatches.set(d.key,d)));
  const docs=[...allMatches.values()];
  $('complianceDocCount').textContent=docs.length; $('complianceDueCount').textContent=docs.filter(complianceDue).length;
  $('isolationCount').textContent=assets.filter(a=>a.electricalIsolation||a.mechanicalIsolation||a.isolationProcedure).length; $('qrAssetCount').textContent=assets.length;
  grid.innerHTML=complianceRegisters.map(r=>{const matches=matchingComplianceDocs(r),due=matches.filter(complianceDue).length;return `<article class="complianceCard"><div class="complianceCardHead"><span>${r.icon}</span><div><h4>${esc(r.title)}</h4><small>${matches.length} evidence record${matches.length===1?'':'s'}</small></div><b class="${due?'due':'ok'}">${due?due+' due':'Current'}</b></div><div class="complianceCardActions"><button data-compliance-open="${esc(r.key)}">Open evidence</button><button data-compliance-upload="${esc(r.category)}">+ Upload</button></div></article>`}).join('');
  const latest=docs.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,10); $('complianceEvidenceCount').textContent=`${docs.length} records`;
  evidence.innerHTML=latest.length?latest.map(d=>`<article><div><b>${esc(d.title)}</b><small>${esc(documentTypeLabel(d.type))}${d.number?' · '+esc(d.number):''}</small></div><span>${d.url?`<a href="${esc(d.url)}" target="_blank" rel="noopener">Open</a>`:'Unavailable'}</span></article>`).join(''):'<p class="emptyState">No compliance evidence has been classified yet. Upload evidence and use a clear category or title.</p>';
}
function showCompliance(){showView('compliance');renderCompliance();closeDrawer();}
function openComplianceUpload(category='Compliance'){showDocuments('');openDocumentUpload();docEls.category.value=category;}
function showQrForAsset(asset){
  if(!asset)return; const modal=$('qrModal'),box=$('qrCode'); $('qrAssetName').textContent=`${asset.id} · ${asset.name}`; $('qrAssetMeta').textContent=`${asset.room} · ${asset.manufacturer||'Manufacturer to confirm'} ${asset.model||''}`.trim(); box.innerHTML='';
  if(typeof QRCode==='undefined'){box.textContent='QR library could not load. Check the internet connection and reload.';}else new QRCode(box,{text:assetUrl(asset.id),width:240,height:240,correctLevel:QRCode.CorrectLevel.M});
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
}
function closeQr(){const m=$('qrModal');m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
function qrDataUrl(){const box=$('qrCode');const c=box.querySelector('canvas');if(c)return c.toDataURL('image/png');const i=box.querySelector('img');return i?.src||'';}
function printQrAsset(asset){const img=qrDataUrl();if(!img)return alert('QR code is not ready yet.');const w=open('','_blank');w.document.write(`<title>${esc(asset.id)} QR label</title><style>body{font-family:Arial;text-align:center;padding:24px}.label{display:inline-block;border:2px solid #111;padding:18px;width:300px}img{width:230px}h1{margin:10px 0 4px;font-size:24px}p{margin:4px;font-size:13px}</style><div class="label"><img src="${img}"><h1>${esc(asset.id)}</h1><p><b>${esc(asset.name)}</b></p><p>${esc(asset.room)}</p><p>Scan for asset record</p></div><script>onload=()=>print()<\/script>`);w.document.close();}
function printAllQrLabels(){
  if(typeof QRCode==='undefined')return alert('QR library could not load. Reload while connected to the internet.');
  const w=open('','_blank');w.document.write('<title>Lime Wood Asset QR Labels</title><style>@page{size:A4;margin:8mm}body{font-family:Arial}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.label{border:1px solid #333;padding:8px;text-align:center;break-inside:avoid}.qr{width:110px;height:110px;margin:auto}.qr canvas,.qr img{width:110px!important;height:110px!important}h3{font-size:14px;margin:5px 0 2px}p{font-size:9px;margin:2px}</style><div class="sheet" id="sheet"></div>');
  const s=w.document.getElementById('sheet');assets.forEach(a=>{const d=w.document.createElement('div');d.className='label';d.innerHTML=`<div class="qr"></div><h3>${esc(a.id)}</h3><p><b>${esc(a.name)}</b></p><p>${esc(a.room)}</p>`;s.appendChild(d);new QRCode(d.querySelector('.qr'),{text:assetUrl(a.id),width:110,height:110,correctLevel:QRCode.CorrectLevel.M});});w.document.write('<script>setTimeout(()=>print(),900)<\/script>');w.document.close();
}


const OPS_STORAGE_KEY='limewood-v52-operations';
const CUSTOM_PLANT_ROOMS_KEY='limewood-custom-plant-rooms-v1';
let ppmRecords=[];
let valveRecords=[];
let valveImportRows=[];
let editingValveId='';
let operationsCloudReady=false;
function todayIso(){return new Date().toISOString().slice(0,10)}
function addMonthsIso(dateStr,months){const d=dateStr?new Date(dateStr+'T12:00:00'):new Date();d.setMonth(d.getMonth()+months);return d.toISOString().slice(0,10)}
function frequencyMonths(freq=''){const f=String(freq).toLowerCase();if(f.includes('month')){const n=parseInt(f)||1;return n}if(f.includes('quarter'))return 3;if(f.includes('6'))return 6;if(f.includes('annual')||f.includes('year'))return 12;if(f.includes('2 year'))return 24;return 12}
function readOpsLocal(){try{return JSON.parse(localStorage.getItem(OPS_STORAGE_KEY)||'{}')}catch{return {}}}
function saveOpsLocal(){localStorage.setItem(OPS_STORAGE_KEY,JSON.stringify({ppmRecords,valveRecords}))}
function localOperationArray(local, key){
 const candidates=[
  local?.[key],
  local?.data?.[key],
  local?.operations?.[key],
  local?.state?.[key],
  local?.payload?.[key]
 ];
 for(const value of candidates){
  if(Array.isArray(value))return value;
  if(value&&typeof value==='object'){
   const nested=Object.values(value).find(Array.isArray);
   if(Array.isArray(nested))return nested;
  }
 }
 return [];
}

function valveRoomTagKey(v){
 const room=canonicalPlantRoomName(v?.plant_room||'').toLowerCase();
 const tag=String(v?.tag||'').trim().toLowerCase();
 return `${room}||${tag}`;
}
function valveIdentity(v){return String(v?.id||v?.tag||v?.valve_no||v?.valveNo||'').trim().toLowerCase()}
function mergeOperationRows(cloudRows=[],localRows=[]){
 const map=new Map();
 for(const row of [...localRows,...cloudRows]){
  const key=(row?.plant_room&&row?.tag)?valveRoomTagKey(row):(valveIdentity(row)||`row-${map.size}`);
  map.set(key,{...(map.get(key)||{}),...row});
 }
 return [...map.values()];
}
function valveCloudPayload(row){
 const tag=String(row?.tag||row?.valve_no||row?.valveNo||row?.valve_number||'').trim();
 if(!tag)return null;
 return {
  tag,
  plant_room:String(row?.plant_room||row?.room||'').trim()||null,
  asset_code:row?.asset_code||row?.asset||null,
  service_duty:String(row?.service_duty||row?.service||row?.description||row?.duty||'').trim()||null,
  valve_type:String(row?.valve_type||row?.type||'').trim()||null,
  size:String(row?.size||row?.valve_size||'').trim()||null,
  normal_position:String(row?.normal_position||row?.position||'').trim()||null,
  last_verified:row?.last_verified||row?.verified_date||null,
  location:String(row?.location||row?.physical_location||'').trim()||null,
  isolation_purpose:String(row?.isolation_purpose||row?.purpose||row?.isolates||'').trim()||null,
  notes:String(row?.notes||row?.comments||'').trim()||null,
  updated_by:session?.user?.id||null
 };
}

async function migrateLocalValvesToCloud(localValves,cloudRows){
 if(!operationsCloudReady||!localValves.length)return {migrated:0,error:null};
 const cloudTags=new Set((cloudRows||[]).map(v=>String(v?.tag||'').trim().toLowerCase()).filter(Boolean));
 const payload=localValves
  .map(valveCloudPayload)
  .filter(Boolean)
  .filter(v=>!cloudTags.has(v.tag.toLowerCase()));

 if(!payload.length)return {migrated:0,error:null};

 const {data,error}=await client
  .from('valve_register')
  .upsert(payload,{onConflict:'plant_room,tag'})
  .select();

 if(error){
  console.error('Valve cloud migration failed:',error);
  localStorage.setItem('limewood-v7-valve-migration-error',JSON.stringify({
   at:new Date().toISOString(),
   message:error.message||String(error)
  }));
  return {migrated:0,error};
 }

 localStorage.removeItem('limewood-v7-valve-migration-error');
 localStorage.setItem('limewood-v7-valves-migrated','true');
 return {migrated:Array.isArray(data)?data.length:payload.length,data:data||[]};
}

async function loadOperations(){
 const local=readOpsLocal();
 const localPpm=localOperationArray(local,'ppmRecords');
 const localValves=localOperationArray(local,'valveRecords');

 const [p,v]=await Promise.all([
  client.from('ppm_schedules').select('*'),
  client.from('valve_register').select('*')
 ]);

 const ppmCloudReady=!p.error;
 const valveCloudReady=!v.error;
 operationsCloudReady=ppmCloudReady||valveCloudReady;

 // Each register now loads independently. A missing/broken PPM table must not hide valves.
 ppmRecords=ppmCloudReady?mergeOperationRows(p.data||[],localPpm):localPpm;
 valveRecords=valveCloudReady?mergeOperationRows(v.data||[],localValves):localValves;

 // If this browser has historical valves, migrate them whenever the VALVE table is available,
 // regardless of the PPM table state.
 if(valveCloudReady&&localValves.length){
   const previousReady=operationsCloudReady;
   operationsCloudReady=true;
   const migration=await migrateLocalValvesToCloud(localValves,v.data||[]);
   operationsCloudReady=previousReady;
   if(!migration.error&&migration.migrated){
     const refreshed=await client.from('valve_register').select('*');
     if(!refreshed.error)valveRecords=mergeOperationRows(refreshed.data||[],localValves);
   }
 }

 // Built-in CSV safety net: if cloud/local are empty, recover the supplied Forest Cottage register.
 if(!valveRecords.length){
   try{
     const res=await fetch('/data/Forest_Cottage_Valve_Register.csv',{cache:'no-store'});
     if(res.ok){
       const text=await res.text();
       const lines=text.split(/\r?\n/).filter(Boolean);
       if(lines.length>1){
         const parseLine=line=>{
           const out=[];let cur='',quoted=false;
           for(let i=0;i<line.length;i++){
             const c=line[i];
             if(c==='"'){
               if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted;
             }else if(c===','&&!quoted){out.push(cur);cur=''}else cur+=c;
           }
           out.push(cur);return out;
         };
         const headers=parseLine(lines[0]).map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
         const recovered=lines.slice(1).map(line=>{
           const vals=parseLine(line),row={};
           headers.forEach((h,i)=>row[h]=vals[i]||'');
           return valveCloudPayload({
             tag:row.tag||row.valve_tag||row.valve_no||row.valve_number,
             plant_room:row.plant_room||'Forest Cottage & Lodges Plant Room',
             asset_code:row.asset_code||row.asset,
             service_duty:row.service_duty||row.service||row.description||row.duty,
             valve_type:row.valve_type||row.type,
             size:row.size||row.valve_size,
             normal_position:row.normal_position||row.position,
             location:row.location||row.physical_location,
             isolation_purpose:row.isolation_purpose||row.purpose||row.isolates,
             last_verified:row.last_verified||row.verified_date,
             notes:row.notes||row.comments
           });
         }).filter(Boolean);
         if(recovered.length)valveRecords=mergeOperationRows(recovered,valveRecords);
       }
     }
   }catch(e){console.warn('Valve CSV recovery failed',e)}
 }

 saveOpsLocal();
 seedPpmFromAssets();
 populateOpsFilters();
 renderPpm();
 renderValves();
 refreshV6Metrics();
 setTimeout(openValveFromUrl,0);

 if(p.error)console.warn('PPM cloud unavailable:',p.error.message||p.error);
 if(v.error)console.warn('Valve cloud unavailable:',v.error.message||v.error);
}

function customPlantRooms(){
 try{return JSON.parse(localStorage.getItem(CUSTOM_PLANT_ROOMS_KEY)||'[]').filter(Boolean)}catch{return[]}
}
function normalisePlantRoomName(name){
 let value=String(name||'').trim().replace(/\s+/g,' ');
 if(value&&!/plant room$/i.test(value))value+=' Plant Room';
 return value;
}

function canonicalPlantRoomName(name){
 const value=normalisePlantRoomName(name);
 const key=value.toLowerCase();
 if(key==='forest cottage plant room'||key==='forest lodges plant room'||key==='forest lodge plant room'||key==='forest cottage & lodges plant room'){
   return 'Forest Cottage & Lodges Plant Room';
 }
 // Historic typo created a second dead room card. Treat both spellings as one room everywhere.
 if(key==='cresent plant room'||key==='crescent plant room') return 'Crescent Plant Room';
 return value;
}
function samePlantRoom(a,b){
 const left=canonicalPlantRoomName(a),right=canonicalPlantRoomName(b);
 return Boolean(left&&right&&left.toLowerCase()===right.toLowerCase());
}

const ESTATE_PLANT_ROOMS=[
 'Main House Plant Room',
 'Staff House Plant Room',
 'Coach House Plant Room',
 'Forest Cottage & Lodges Plant Room',
 'Spa Plant Room',
 'Pavilion Plant Room',
 'Barn Plant Room',
 'Crescent Plant Room'
];

function allKnownPlantRooms(){
 return [...new Set([
  ...ESTATE_PLANT_ROOMS,
  ...assets.map(a=>a.room),
  ...plantRooms.map(r=>r.name),
  ...valveRecords.map(v=>v.plant_room),
  ...customPlantRooms()
 ].filter(Boolean).map(canonicalPlantRoomName))]
 .sort((a,b)=>a.localeCompare(b));
}
function saveCustomPlantRoom(name){
 name=normalisePlantRoomName(name);
 const existing=customPlantRooms();
 const match=existing.find(x=>x.toLowerCase()===name.toLowerCase());
 const rooms=[...existing];
 if(!match&&name)rooms.push(name);
 rooms.sort((a,b)=>a.localeCompare(b));
 localStorage.setItem(CUSTOM_PLANT_ROOMS_KEY,JSON.stringify(rooms));
 return match||name;
}
function refreshPlantRoomEverywhere(){
 populateOpsFilters();
 fillValveImportRooms();
 refreshPlantRoomNav();
 renderDashboard();
}
async function addPlantRoomFromUi(targetSelectId){
 let name=prompt('Enter the new plant room name, for example Crescent Plant Room:');
 if(name===null)return;
 name=normalisePlantRoomName(name);
 if(!name)return alert('Enter a plant room name.');
 const existing=allPlantRoomNames().find(x=>x.toLowerCase()===name.toLowerCase());
 if(existing){
  const target=$(targetSelectId);if(target){target.value=existing;target.dispatchEvent(new Event('change'))}
  return alert(`${existing} already exists and has been selected.`);
 }
 try{
  if(operationsCloudReady)await ensurePlantRoom(name);
  name=saveCustomPlantRoom(name);
  refreshPlantRoomEverywhere();
  const target=$(targetSelectId);if(target){target.value=name;target.dispatchEvent(new Event('change'))}
  alert(`${name} added to all plant-room lists.`);
 }catch(error){
  console.error(error);
  name=saveCustomPlantRoom(name);refreshPlantRoomEverywhere();
  const target=$(targetSelectId);if(target)target.value=name;
  alert(`${name} was added on this device and is now available throughout the app. Cloud sync was unavailable: ${error.message}`);
 }
}

function seedPpmFromAssets(){
 assets.forEach(a=>{if(!a.ppm)return;let r=ppmRecords.find(x=>x.asset_code===a.id);if(!r)ppmRecords.push({id:`local-${a.id}`,asset_code:a.id,frequency:a.ppm,last_completed:'',next_due:'',assigned_to:'',completion_status:'Scheduled',task:`Routine ${a.ppm} maintenance`,notes:''});});
 if(!operationsCloudReady)saveOpsLocal();
}
function assetForCode(code){return assets.find(a=>a.id===code)}
function ppmStatus(r){if(r.completion_status==='Complete'&&r.last_completed){const month=new Date(r.last_completed+'T12:00:00');const now=new Date();if(month.getMonth()===now.getMonth()&&month.getFullYear()===now.getFullYear())return 'Complete'}if(!r.next_due)return 'Date required';const days=Math.ceil((new Date(r.next_due+'T12:00:00')-new Date())/86400000);if(days<0)return 'Overdue';if(days<=30)return 'Due soon';return 'Scheduled'}
function populateOpsFilters(){
 const rooms=[...new Set([...assets.map(a=>a.room),...plantRooms.map(r=>r.name),...valveRecords.map(v=>v.plant_room),...customPlantRooms()].filter(Boolean).map(canonicalPlantRoomName))].sort((a,b)=>a.localeCompare(b));
 ['ppmRoom','valveRoom'].forEach(id=>{const s=$(id);if(!s)return;const old=s.value;s.innerHTML='<option value="">All plant rooms</option>'+rooms.map(r=>`<option>${esc(r)}</option>`).join('');s.value=old});
 renderValveRoomButtons(rooms);
 const vr=$('vRoom');if(vr)vr.innerHTML=rooms.map(r=>`<option>${esc(r)}</option>`).join('');
 const va=$('vAsset');if(va)va.innerHTML='<option value="">No linked asset</option>'+assets.map(a=>`<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.name)}</option>`).join('');
}

function renderValveRoomButtons(rooms){
 const grid=$('valveRoomButtons');if(!grid)return;
 grid.innerHTML=rooms.length?rooms.map(name=>{const count=valveRecords.filter(v=>samePlantRoom(v.plant_room,name)).length;return `<button type="button" class="valveRoomCard" data-valve-room-card="${esc(name)}"><span class="roomIcon">🏭</span><span><b>${esc(name.replace(/ Plant Room$/i,''))}</b><small>${count} valve${count===1?'':'s'}</small></span><span class="roomCardArrow">Open register →</span></button>`}).join(''):'<p class="emptyState">No plant rooms have been added yet.</p>';
}
function showValveDirectory(){const select=$('valveRoom');if(select)select.value='';$('valveSearch').value='';$('valvePosition').value='';renderValves();}
function openValveRoomRegister(room){const select=$('valveRoom');if(!select||!room)return;select.value=room;$('valveSearch').value='';$('valvePosition').value='';renderValves();}


let currentPpmRoom='';

function ppmRoomFor(r){return canonicalPlantRoomName(r.plant_room||assetForCode(r.asset_code)?.room||'')}
function ppmEnhancedStatus(r){
 if(r.completion_status==='Complete'&&r.last_completed)return 'Complete';
 if(!r.next_due)return 'Date required';
 const today=new Date();today.setHours(0,0,0,0);
 const due=new Date(r.next_due+'T12:00:00');
 const days=Math.ceil((due-today)/86400000);
 if(days<0)return 'Overdue';
 if(days<=7)return 'Due this week';
 if(days<=30)return 'Due this month';
 return 'Scheduled';
}
function ppmRooms(){
 const rooms=new Set(allKnownPlantRooms().map(canonicalPlantRoomName));
 ppmRecords.forEach(r=>{const room=ppmRoomFor(r);if(room)rooms.add(room)});
 return [...rooms].filter(Boolean).sort((a,b)=>a.localeCompare(b));
}
function ppmSummary(){
 const rows=ppmRecords.map(r=>({...r,computed:ppmEnhancedStatus(r)}));
 const overdue=rows.filter(r=>r.computed==='Overdue').length;
 const week=rows.filter(r=>r.computed==='Due this week').length;
 const month=rows.filter(r=>r.computed==='Due this month').length+week;
 const now=new Date();
 const complete=rows.filter(r=>{
   if(r.computed!=='Complete'||!r.last_completed)return false;
   const d=new Date(r.last_completed+'T12:00:00');
   return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
 }).length;
 const dated=rows.filter(r=>r.computed!=='Date required').length;
 const compliance=dated?Math.max(0,Math.round(((dated-overdue)/dated)*100)):100;
 $('ppmOverdue').textContent=overdue;
 $('ppmDueWeek').textContent=week;
 $('ppmDueMonth').textContent=month;
 $('ppmCompleted').textContent=complete;
 $('ppmCompliance').textContent=`${compliance}%`;
}
function renderPpmDirectory(){
 ppmSummary();
 const host=$('ppmRoomButtons');if(!host)return;
 const rooms=ppmRooms();
 host.innerHTML=rooms.length?rooms.map(room=>{
   const schedules=ppmRecords.filter(r=>samePlantRoom(ppmRoomFor(r),room));
   const overdue=schedules.filter(r=>ppmEnhancedStatus(r)==='Overdue').length;
   const due=schedules.filter(r=>['Due this week','Due this month'].includes(ppmEnhancedStatus(r))).length;
   const detail=overdue?`${overdue} overdue`:due?`${due} due soon`:`${schedules.length} schedule${schedules.length===1?'':'s'}`;
   return `<button type="button" data-ppm-room="${esc(room)}"><span>🛠</span><b>${esc(room.replace(/ Plant Room$/i,''))}</b><small>${detail}</small></button>`;
 }).join(''):'<div class="emptyState">No plant rooms have been added yet.</div>';
}
function showPpmDirectory(){
 currentPpmRoom='';
 showView('ppm');
 $('ppmDirectoryPanel').hidden=false;
 $('ppmRegisterPanel').hidden=true;
 $('ppmPageTitle').textContent='PPM Centre';
 $('ppmPageDescription').textContent='Plan, monitor and review preventative maintenance across the estate.';
 renderPpmDirectory();
 closeDrawer();
}
function openPpmRoom(room){
 currentPpmRoom=canonicalPlantRoomName(room)||'';
 showView('ppm');
 $('ppmDirectoryPanel').hidden=true;
 $('ppmRegisterPanel').hidden=false;
 $('ppmPageTitle').textContent=`${currentPpmRoom.replace(/ Plant Room$/i,'')} PPM`;
 $('ppmPageDescription').textContent='Planned maintenance schedules for the selected plant room.';
 $('ppmRoomTitle').textContent=currentPpmRoom;
 $('ppmRoom').value=currentPpmRoom;
 renderPpm();
 closeDrawer();
}
function ppmStatusClass(status){
 return status==='Overdue'?'danger':status==='Due this week'?'warn':status==='Due this month'?'amber':status==='Complete'?'ok':'neutral';
}
function renderPpm(){
 ppmSummary();
 const q=String($('ppmSearch')?.value||'').toLowerCase();
 const status=$('ppmStatus')?.value||'';
 const rows=ppmRecords.map(r=>({...r,asset:assetForCode(r.asset_code),computed:ppmEnhancedStatus(r)}))
  .filter(r=>!currentPpmRoom||samePlantRoom(ppmRoomFor(r),currentPpmRoom))
  .filter(r=>!status||r.computed===status)
  .filter(r=>{
    const hay=[r.asset_code,r.asset?.name,r.asset?.room,r.assigned_to,r.task,r.notes,r.frequency].join(' ').toLowerCase();
    return !q||hay.includes(q);
  })
  .sort((a,b)=>String(a.next_due||'9999').localeCompare(String(b.next_due||'9999')));
 if($('ppmRoomCount'))$('ppmRoomCount').textContent=`${rows.length} schedule${rows.length===1?'':'s'}`;
 const host=$('ppmCards');if(!host)return;
 host.innerHTML=rows.length?rows.map(r=>{
   const status=r.computed;
   return `<button class="ppmTaskCard" data-ppm="${esc(r.asset_code)}">
    <div class="ppmTaskTop"><span class="ppmStatus ${ppmStatusClass(status)}">${esc(status)}</span><span class="ppmDue">${esc(r.next_due||'No due date')}</span></div>
    <h4>${esc(r.asset?.name||r.asset_code||'Asset')}</h4>
    <p>${esc(r.task||'Planned preventative maintenance')}</p>
    <div class="ppmMeta"><span><b>Frequency</b>${esc(r.frequency||'To confirm')}</span><span><b>Last completed</b>${esc(r.last_completed||'No record')}</span><span><b>Assigned</b>${esc(r.assigned_to||'Unassigned')}</span></div>
   </button>`;
 }).join(''):`<div class="emptyState ppmEmpty"><b>No PPM schedules in this plant room yet.</b><span>Use “Add PPM” to create the first schedule.</span></div>`;
}
function openPpm(code){
 const r=ppmRecords.find(x=>x.asset_code===code),a=assetForCode(code);if(!r)return;
 $('ppmModalTitle').textContent=`${code} · ${a?.name||'PPM schedule'}`;$('ppmAsset').value=code;$('ppmFrequency').value=r.frequency||a?.ppm||'';$('ppmLast').value=r.last_completed||'';$('ppmNext').value=r.next_due||'';$('ppmAssigned').value=r.assigned_to||'';$('ppmCompletion').value=r.completion_status||'Scheduled';$('ppmTask').value=r.task||'';$('ppmNotes').value=r.notes||'';openOpsModal('ppmModal')
}
async function savePpmRecord(){
 const code=$('ppmAsset').value,r=ppmRecords.find(x=>x.asset_code===code);if(!r)return;
 Object.assign(r,{frequency:$('ppmFrequency').value,last_completed:$('ppmLast').value,next_due:$('ppmNext').value,assigned_to:$('ppmAssigned').value.trim(),completion_status:$('ppmCompletion').value,task:$('ppmTask').value.trim(),notes:$('ppmNotes').value.trim(),updated_at:new Date().toISOString()});
 if(r.completion_status==='Complete'&&r.last_completed&&!r.next_due)r.next_due=addMonthsIso(r.last_completed,frequencyMonths(r.frequency));
 if(operationsCloudReady){
  const payload={asset_code:r.asset_code,frequency:r.frequency,last_completed:r.last_completed||null,next_due:r.next_due||null,assigned_to:r.assigned_to||null,completion_status:r.completion_status,task:r.task||null,notes:r.notes||null,updated_by:session.user.id};
  const {data,error}=await client.from('ppm_schedules').upsert(payload,{onConflict:'asset_code'}).select().single();
  if(error)return alert(error.message);Object.assign(r,data)
 }else saveOpsLocal();
 closeOpsModal('ppmModal');renderPpm();renderPpmDirectory()
}
function populatePpmAddForm(){
 const rooms=ppmRooms();
 const roomSel=$('ppmAddRoom'),assetSel=$('ppmAddAsset');
 roomSel.innerHTML=rooms.map(r=>`<option>${esc(r)}</option>`).join('');
 roomSel.value=currentPpmRoom||rooms[0]||'';
 const refreshAssets=()=>{
   const room=roomSel.value;
   const available=assets.filter(a=>samePlantRoom(a.room,room)&&!ppmRecords.some(p=>p.asset_code===a.id));
   assetSel.innerHTML=available.length?available.map(a=>`<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.name)}</option>`).join(''):'<option value="">No unscheduled assets in this room</option>';
 };
 roomSel.onchange=refreshAssets;refreshAssets();
}
async function createPpmSchedule(){
 const code=$('ppmAddAsset').value;if(!code)return alert('Choose an asset first.');
 const record={id:`local-${code}`,asset_code:code,frequency:$('ppmAddFrequency').value.trim()||assetForCode(code)?.ppm||'',last_completed:'',next_due:$('ppmAddNext').value,assigned_to:$('ppmAddAssigned').value.trim(),completion_status:'Scheduled',task:$('ppmAddTask').value.trim(),notes:$('ppmAddNotes').value.trim()};
 ppmRecords.push(record);
 if(operationsCloudReady){
  const payload={asset_code:record.asset_code,frequency:record.frequency||null,last_completed:null,next_due:record.next_due||null,assigned_to:record.assigned_to||null,completion_status:'Scheduled',task:record.task||null,notes:record.notes||null,updated_by:session.user.id};
  const {data,error}=await client.from('ppm_schedules').upsert(payload,{onConflict:'asset_code'}).select().single();
  if(error){ppmRecords=ppmRecords.filter(r=>r!==record);return alert(error.message)}
  Object.assign(record,data);
 }else saveOpsLocal();
 closeOpsModal('ppmAddModal');
 if(currentPpmRoom)renderPpm();else renderPpmDirectory();
 ppmSummary();
}

// ===== v6.4 Logs & Checks =====
const LOG_STORAGE_KEY='limewood-v64-log-entries';
let logEntries=[];
let logsCloudReady=false;
let currentLogType='';

const LOG_TEMPLATES={
  pool_water:{icon:'🏊',title:'Pool Water Test',description:'Record routine pool-water readings and any action taken.',fields:[
    {key:'location',label:'Pool / water body',type:'text',required:true,placeholder:'e.g. Main pool'},
    {key:'plant_room',label:'Plant room',type:'room'},
    {key:'free_chlorine',label:'Free chlorine',type:'number',step:'0.01',suffix:'mg/L'},
    {key:'total_chlorine',label:'Total chlorine',type:'number',step:'0.01',suffix:'mg/L'},
    {key:'ph',label:'pH',type:'number',step:'0.01'},
    {key:'water_temperature',label:'Water temperature',type:'number',step:'0.1',suffix:'°C'},
    {key:'alkalinity',label:'Total alkalinity',type:'number',step:'1',suffix:'mg/L'},
    {key:'visual_condition',label:'Visual condition',type:'select',options:['Clear / normal','Cloudy','Discoloured','Other']},
    {key:'corrective_action',label:'Corrective action',type:'textarea',wide:true,placeholder:'Record any dosing, adjustment, retest or other action'},
    {key:'notes',label:'Notes',type:'textarea',wide:true}
  ]},
  spa_water:{icon:'💧',title:'Spa Water Test',description:'Record routine spa-water readings and corrective action.',fields:[
    {key:'location',label:'Spa / water body',type:'text',required:true,placeholder:'e.g. Hydro pool'},
    {key:'plant_room',label:'Plant room',type:'room'},
    {key:'free_chlorine',label:'Free chlorine',type:'number',step:'0.01',suffix:'mg/L'},
    {key:'total_chlorine',label:'Total chlorine',type:'number',step:'0.01',suffix:'mg/L'},
    {key:'ph',label:'pH',type:'number',step:'0.01'},
    {key:'water_temperature',label:'Water temperature',type:'number',step:'0.1',suffix:'°C'},
    {key:'visual_condition',label:'Visual condition',type:'select',options:['Clear / normal','Cloudy','Discoloured','Other']},
    {key:'corrective_action',label:'Corrective action',type:'textarea',wide:true},
    {key:'notes',label:'Notes',type:'textarea',wide:true}
  ]},
  meter_reading:{icon:'📟',title:'Meter Reading',description:'Record an electrical, gas, water, heat or other meter reading.',fields:[
    {key:'meter_name',label:'Meter / reference',type:'text',required:true},
    {key:'location',label:'Location',type:'text',required:true},
    {key:'plant_room',label:'Plant room',type:'room'},
    {key:'reading',label:'Reading',type:'number',step:'0.001',required:true},
    {key:'unit',label:'Unit',type:'text',placeholder:'kWh, m³, litres, etc.'},
    {key:'notes',label:'Notes',type:'textarea',wide:true}
  ]},
  temperature_check:{icon:'🌡️',title:'Temperature Check',description:'Record a routine temperature check against a location or point.',fields:[
    {key:'location',label:'Location / point',type:'text',required:true},
    {key:'plant_room',label:'Plant room',type:'room'},
    {key:'temperature',label:'Temperature',type:'number',step:'0.1',required:true,suffix:'°C'},
    {key:'outcome',label:'Outcome',type:'select',options:['Normal','Review required','Action taken']},
    {key:'action',label:'Action / observations',type:'textarea',wide:true}
  ]},
  plant_room_check:{icon:'🏭',title:'Plant Room Check',description:'Record a routine visual or operational plant-room check.',fields:[
    {key:'plant_room',label:'Plant room',type:'room',required:true},
    {key:'condition',label:'Overall condition',type:'select',options:['Normal','Attention required','Urgent attention required']},
    {key:'leaks',label:'Leaks observed',type:'select',options:['No','Yes']},
    {key:'alarms',label:'Active alarms / faults',type:'select',options:['No','Yes']},
    {key:'housekeeping',label:'Housekeeping',type:'select',options:['Good','Needs attention']},
    {key:'action',label:'Action / defects found',type:'textarea',wide:true},
    {key:'notes',label:'Notes',type:'textarea',wide:true}
  ]},
  other:{icon:'✍️',title:'Other Log',description:'Create a general engineering log entry.',fields:[
    {key:'title',label:'Log title',type:'text',required:true},
    {key:'location',label:'Location',type:'text'},
    {key:'plant_room',label:'Plant room',type:'room'},
    {key:'details',label:'Details',type:'textarea',wide:true,required:true}
  ]}
};

function readLocalLogs(){try{return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY)||'[]')}catch{return[]}}
function saveLocalLogs(){try{localStorage.setItem(LOG_STORAGE_KEY,JSON.stringify(logEntries))}catch(e){}}
function logUserLabel(){const meta=session?.user?.user_metadata||{};return meta.full_name||meta.name||session?.user?.email||'Signed-in user'}
function logTypeLabel(type){return LOG_TEMPLATES[type]?.title||String(type||'Log')}
function renderLogTypes(){
 const host=$('logTypeGrid');if(!host)return;
 host.innerHTML=Object.entries(LOG_TEMPLATES).map(([key,t])=>`<button type="button" data-log-type="${esc(key)}"><span>${t.icon}</span><b>${esc(t.title)}</b><small>${esc(t.description)}</small></button>`).join('');
 const typeFilter=$('logHistoryType');if(typeFilter){const current=typeFilter.value;typeFilter.innerHTML='<option value="">All log types</option>'+Object.entries(LOG_TEMPLATES).map(([k,t])=>`<option value="${esc(k)}">${esc(t.title)}</option>`).join('');typeFilter.value=current}
}
function logFieldHtml(field){
 const id=`logField_${field.key}`,req=field.required?'required':'';
 let control='';
 if(field.type==='textarea')control=`<textarea id="${id}" data-log-key="${esc(field.key)}" rows="4" ${req} placeholder="${esc(field.placeholder||'')}"></textarea>`;
 else if(field.type==='select')control=`<select id="${id}" data-log-key="${esc(field.key)}" ${req}>${(field.options||[]).map(o=>`<option>${esc(o)}</option>`).join('')}</select>`;
 else if(field.type==='room')control=`<select id="${id}" data-log-key="${esc(field.key)}" ${req}><option value="">Select plant room</option>${allPlantRoomNames().map(r=>`<option>${esc(r)}</option>`).join('')}</select>`;
 else control=`<input id="${id}" data-log-key="${esc(field.key)}" type="${field.type||'text'}" ${field.step?`step="${esc(field.step)}"`:''} ${req} placeholder="${esc(field.placeholder||'')}">`;
 return `<label class="${field.wide?'wide':''}"><span>${esc(field.label)}${field.suffix?` <small>(${esc(field.suffix)})</small>`:''}</span>${control}</label>`;
}
function showLogsHome(){showView('logs');currentLogType='';$('logTypePanel').hidden=false;$('logFormPanel').hidden=true;$('logHistoryPanel').hidden=true;renderLogTypes();closeDrawer()}
function beginLog(type){
 const t=LOG_TEMPLATES[type];if(!t)return;currentLogType=type;showView('logs');$('logTypePanel').hidden=true;$('logHistoryPanel').hidden=true;$('logFormPanel').hidden=false;$('logFormTitle').textContent=t.title;$('logFormDescription').textContent=t.description;$('dynamicLogFields').innerHTML=t.fields.map(logFieldHtml).join('');$('logAutoTime').textContent=new Date().toLocaleString();$('logAutoUser').textContent=logUserLabel();$('logSaveMessage').hidden=true;window.scrollTo({top:0,behavior:'smooth'});
}
function collectLogPayload(){const payload={};document.querySelectorAll('#dynamicLogFields [data-log-key]').forEach(el=>{payload[el.dataset.logKey]=el.value});return payload}
function queuedLogCount(){return logEntries.filter(x=>x.sync_status==='pending').length}
async function loadLogs(){
 const local=readLocalLogs();
 try{
   const {data,error}=await client.from('log_entries').select('*').order('logged_at',{ascending:false}).limit(500);
   logsCloudReady=!error;
   if(!error){
     const map=new Map();[...local,...(data||[])].forEach(r=>map.set(r.client_id||r.id,{...map.get(r.client_id||r.id),...r,sync_status:'synced'}));
     logEntries=[...map.values()].sort((a,b)=>String(b.logged_at||'').localeCompare(String(a.logged_at||'')));
     await syncPendingLogs();
   }else logEntries=local;
 }catch(e){logsCloudReady=false;logEntries=local}
 saveLocalLogs();renderLogHistory();
}
async function syncPendingLogs(){
 if(!logsCloudReady)return;
 const pending=logEntries.filter(r=>r.sync_status==='pending');
 for(const r of pending){
   const payload={client_id:r.client_id,log_type:r.log_type,location:r.location||null,plant_room:r.plant_room||null,logged_at:r.logged_at,logged_by:session?.user?.id||null,logged_by_email:r.logged_by_email||session?.user?.email||null,payload:r.payload||{},status:r.status||'Logged'};
   const {data,error}=await client.from('log_entries').upsert(payload,{onConflict:'client_id'}).select().single();
   if(!error){Object.assign(r,data,{sync_status:'synced'})}
 }
 saveLocalLogs();
}
async function saveDynamicLog(e){
 e.preventDefault();const t=LOG_TEMPLATES[currentLogType];if(!t)return;
 const payload=collectLogPayload(),now=new Date().toISOString(),clientId=`log-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
 const record={client_id:clientId,log_type:currentLogType,location:payload.location||payload.meter_name||payload.title||'',plant_room:canonicalPlantRoomName(payload.plant_room||'')||null,logged_at:now,logged_by:session?.user?.id||null,logged_by_email:session?.user?.email||'',payload,status:'Logged',sync_status:'pending'};
 logEntries.unshift(record);saveLocalLogs();
 let savedCloud=false;
 if(logsCloudReady){
   const db={client_id:record.client_id,log_type:record.log_type,location:record.location||null,plant_room:record.plant_room,logged_at:record.logged_at,logged_by:record.logged_by,logged_by_email:record.logged_by_email||null,payload:record.payload,status:record.status};
   const {data,error}=await client.from('log_entries').insert(db).select().single();
   if(!error){Object.assign(record,data,{sync_status:'synced'});savedCloud=true;saveLocalLogs()}
 }
 const msg=$('logSaveMessage');msg.hidden=false;msg.className=`logSaveMessage ${savedCloud?'success':'pending'}`;msg.textContent=savedCloud?'Log saved to the database.':'Saved on this phone and queued for database sync.';
 $('dynamicLogForm').reset();setTimeout(()=>showLogsHome(),1000);renderLogHistory();
}
function logPayloadSummary(r){
 const p=r.payload||{};const bits=[];
 for(const [k,v] of Object.entries(p)){if(v&&k!=='notes'&&k!=='details'&&k!=='corrective_action'&&bits.length<3)bits.push(`${k.replaceAll('_',' ')}: ${v}`)}
 return bits.join(' · ')||p.notes||p.details||'Log recorded';
}
function renderLogHistory(){
 const host=$('logHistoryList');if(!host)return;
 const q=String($('logHistorySearch')?.value||'').toLowerCase(),type=$('logHistoryType')?.value||'';
 const rows=logEntries.filter(r=>!type||r.log_type===type).filter(r=>!q||[logTypeLabel(r.log_type),r.location,r.plant_room,r.logged_by_email,JSON.stringify(r.payload||{})].join(' ').toLowerCase().includes(q));
 host.innerHTML=rows.length?rows.map(r=>`<article class="logHistoryCard"><div class="logHistoryIcon">${LOG_TEMPLATES[r.log_type]?.icon||'📝'}</div><div class="logHistoryBody"><div class="logHistoryTop"><b>${esc(logTypeLabel(r.log_type))}</b><span class="logSync ${r.sync_status==='pending'?'pending':'synced'}">${r.sync_status==='pending'?'Waiting to sync':'Synced'}</span></div><p>${esc(r.location||r.plant_room||'Engineering log')}</p><small>${esc(new Date(r.logged_at).toLocaleString())} · ${esc(r.payload?.operator_name||r.logged_by_email||'User')}</small><em>${esc(logPayloadSummary(r))}</em></div></article>`).join(''):'<div class="emptyState">No logs have been recorded yet.</div>';
}
function showLogHistory(){showView('logs');$('logTypePanel').hidden=true;$('logFormPanel').hidden=true;$('logHistoryPanel').hidden=false;renderLogHistory();closeDrawer()}
window.addEventListener('online',()=>syncPendingLogs().then(renderLogHistory));
// ===== end Logs & Checks =====

function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(quoted){if(c==='"'&&n==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
  else if(c==='"')quoted=true;
  else if(c===','){row.push(field);field=''}
  else if(c==='\n'){row.push(field);rows.push(row);row=[];field=''}
  else if(c!=='\r')field+=c;
 }
 if(field.length||row.length){row.push(field);rows.push(row)}
 return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function normalizeHeader(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function pickCsvValue(obj,names){for(const n of names){const key=Object.keys(obj).find(k=>normalizeHeader(k)===normalizeHeader(n));if(key&&String(obj[key]??'').trim())return String(obj[key]).trim()}return''}
function valveTagPrefix(room){const words=String(room||'Valve').replace(/plant room/ig,'').trim().split(/\s+/).filter(Boolean);return(words.map(w=>w[0]).join('').slice(0,3)||'V').toUpperCase()+'-V-'}
function inferValveFields(description){
 const d=String(description||'').trim();
 const size=(d.match(/\b(?:\d+(?:\.\d+)?\s*(?:mm|inch|in|\")|DN\s*\d+)\b/i)||[])[0]||'';
 const typeMatch=d.match(/\b(LBV|IV|NRV|PRV|DRV|ADVO|PICV|ball valve|butterfly valve|gate valve|solenoid valve|double check valve|2 port valve|Y type strainer|Y strainer|lockshield valve|service valve)\b/i);
 return{size,valve_type:typeMatch?typeMatch[0]:'',service_duty:d};
}
function mapValveCsvRows(matrix,room){
 if(matrix.length<2)throw new Error('The CSV does not contain any data rows.');
 const headers=matrix[0].map(h=>String(h).trim());
 return matrix.slice(1).map((values,index)=>{
  const obj={};headers.forEach((h,i)=>obj[h]=values[i]??'');
  const rawNo=pickCsvValue(obj,['Valve No','Valve Number','Valve','No','Tag','Valve tag']);
  const description=pickCsvValue(obj,['Description','Service duty','Service / duty','Duty','Valve description']);
  if(!rawNo&&!description)return null;
  const tag=/[A-Za-z]/.test(rawNo)?rawNo:`${valveTagPrefix(room)}${String(rawNo||index+1).padStart(3,'0')}`;
  const inferred=inferValveFields(description);
  return{
   tag,
   plant_room:pickCsvValue(obj,['Plant room','Plant Room','Location'])||room,
   asset_code:pickCsvValue(obj,['Linked asset','Asset ID','Asset code'])||null,
   service_duty:pickCsvValue(obj,['Service duty','Service / duty','Duty','Description'])||inferred.service_duty,
   valve_type:pickCsvValue(obj,['Type','Valve type'])||inferred.valve_type,
   size:pickCsvValue(obj,['Size','Valve size'])||inferred.size,
   normal_position:pickCsvValue(obj,['Normal position','Position'])||'To confirm',
   location:pickCsvValue(obj,['Exact location','Valve location'])||'',
   isolation_purpose:pickCsvValue(obj,['Isolation purpose','Isolation','Function'])||description,
   last_verified:pickCsvValue(obj,['Last verified','Verified date'])||null,
   notes:pickCsvValue(obj,['Notes'])||''
  }
 }).filter(Boolean);
}
function fillValveImportRooms(){
 const rooms=allKnownPlantRooms();
 const select=$('valveImportRoom');if(!select)return;
 const previous=select.value || localStorage.getItem('limewood-last-valve-import-room') || els.room?.value || '';
 select.innerHTML='<option value="">Select plant room</option>'+rooms.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
 if(previous && rooms.includes(previous)) select.value=previous;
 else if(rooms.includes('Main House Plant Room')) select.value='Main House Plant Room';
 select.onchange=()=>localStorage.setItem('limewood-last-valve-import-room',select.value);
}
function resetValveImport(){
 valveImportRows=[];$('valveImportFile').value='';$('valveImportSummary').textContent='No file selected.';$('valveImportPreview').innerHTML='<tr><td colspan="5" class="emptyState">Select a CSV or XLSX file to preview it.</td></tr>';$('valveImportMessage').textContent='';$('confirmValveImport').disabled=true;
}
async function valveFileMatrix(file){
 const name=String(file?.name||'').toLowerCase();
 if(name.endsWith('.csv'))return parseCsv(await file.text());
 if(name.endsWith('.xlsx')){
  if(typeof XLSX==='undefined')throw new Error('Excel reader failed to load. Check the internet connection and refresh the app.');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const firstSheet=workbook.SheetNames[0];
  if(!firstSheet)throw new Error('The Excel workbook does not contain a worksheet.');
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet],{header:1,defval:'',raw:false,blankrows:false});
 }
 throw new Error('Choose a .csv or .xlsx file.');
}
function openValveImport(){fillValveImportRooms();resetValveImport();openOpsModal('valveImportModal')}
async function previewValveImport(){
 const file=$('valveImportFile').files[0];if(!file)return resetValveImport();
 try{
  const matrix=await valveFileMatrix(file);valveImportRows=mapValveCsvRows(matrix,$('valveImportRoom').value);
  const existing=new Set(valveRecords.map(valveRoomTagKey));
   const duplicates=valveImportRows.filter(v=>existing.has(valveRoomTagKey(v))).length;
  $('valveImportSummary').innerHTML=`<b>${valveImportRows.length}</b> rows detected · <b>${valveImportRows.length-duplicates}</b> new · <b>${duplicates}</b> existing tag${duplicates===1?'':'s'}`;
  $('valveImportPreview').innerHTML=valveImportRows.slice(0,12).map(v=>`<tr><td><b>${esc(v.tag)}</b></td><td>${esc(v.service_duty)}</td><td>${esc(v.valve_type||'To confirm')}</td><td>${esc(v.size||'To confirm')}</td><td>${esc(v.normal_position)}</td></tr>`).join('')+(valveImportRows.length>12?`<tr><td colspan="5" class="emptyState">Previewing 12 of ${valveImportRows.length} rows.</td></tr>`:'');
  $('confirmValveImport').disabled=!valveImportRows.length;$('valveImportMessage').textContent='';
 }catch(error){valveImportRows=[];$('confirmValveImport').disabled=true;$('valveImportSummary').textContent='Import preview failed.';$('valveImportPreview').innerHTML='<tr><td colspan="5" class="emptyState">Check the CSV or Excel headings and try again.</td></tr>';$('valveImportMessage').textContent=error.message}
}
async function confirmValveImport(){
 if(!valveImportRows.length)return;
 const button=$('confirmValveImport'),mode=$('valveImportDuplicates').value,existingByKey=new Map(valveRecords.map(v=>[valveRoomTagKey(v),v]));
 const rows=valveImportRows.map((v,i)=>({...v,id:`local-import-${Date.now()}-${i}`,updated_at:new Date().toISOString()}));
 const newRows=rows.filter(v=>!existingByKey.has(valveRoomTagKey(v)));
 const updateRows=mode==='update'?rows.filter(v=>existingByKey.has(valveRoomTagKey(v))):[];
 button.disabled=true;button.textContent='Importing…';$('valveImportMessage').textContent='';
 try{
  if(operationsCloudReady){
   const payloadRows=[...newRows,...updateRows].map(({id,...v})=>({...v,updated_by:session.user.id}));
   if(payloadRows.length){const {data,error}=await client.from('valve_register').upsert(payloadRows,{onConflict:'plant_room,tag'}).select();if(error)throw error;for(const saved of data||[]){const old=valveRecords.find(v=>valveRoomTagKey(v)===valveRoomTagKey(saved));if(old)Object.assign(old,saved);else valveRecords.push(saved)}}
  }else{
   for(const v of newRows)valveRecords.push(v);
   for(const v of updateRows)Object.assign(existingByKey.get(valveRoomTagKey(v)),v,{id:existingByKey.get(valveRoomTagKey(v)).id});
   saveOpsLocal();
  }
  const skipped=rows.length-newRows.length-updateRows.length;
  $('valveImportMessage').classList.add('success');$('valveImportMessage').textContent=`Imported ${newRows.length}, updated ${updateRows.length}, skipped ${skipped}.`;
  renderValves();refreshPlantRoomNav();setTimeout(()=>closeOpsModal('valveImportModal'),900);
 }catch(error){$('valveImportMessage').classList.remove('success');$('valveImportMessage').textContent=error.message||'The import failed.'}
 finally{button.disabled=false;button.textContent='Import valves'}
}

let currentValveDetailId='';
function valveNumberLabel(v){const raw=String(v?.tag||'').trim();const match=raw.match(/(?:^|[-\s])V(?:ALVE)?[-\s]*0*(\d+)(?:$|[-\s])/i)||raw.match(/^0*(\d+)$/);return match?`Valve ${Number(match[1])}`:(raw||'Untagged valve')}
function valveSortNumber(v){const m=valveNumberLabel(v).match(/(\d+)/);return m?Number(m[1]):999999}
function filteredValveRows(){const q=$('valveSearch').value.toLowerCase(),room=$('valveRoom').value,pos=$('valvePosition').value;return valveRecords.filter(v=>{const hay=[v.tag,v.plant_room,v.service_duty,v.valve_type,v.size,v.location,v.isolation_purpose,v.notes,v.asset_code].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!room||samePlantRoom(v.plant_room,room))&&(!pos||v.normal_position===pos)}).sort((a,b)=>valveSortNumber(a)-valveSortNumber(b)||String(a.tag).localeCompare(String(b.tag)))}
function valvePositionClass(position){const p=String(position||'').toLowerCase();return p.includes('closed')?'closed':p.includes('open')?'open':'other'}
function renderValves(){const body=$('valveRows');if(!body)return;const room=$('valveRoom').value,rooms=allPlantRoomNames();
 renderValveRoomButtons(rooms);
 $('valveTotal').textContent=valveRecords.length;$('valveOpen').textContent=valveRecords.filter(v=>String(v.normal_position).toLowerCase().includes('open')).length;$('valveClosed').textContent=valveRecords.filter(v=>String(v.normal_position).toLowerCase().includes('closed')).length;$('valveVerifyDue').textContent=valveRecords.filter(v=>!v.last_verified||(Date.now()-new Date(v.last_verified+'T12:00:00'))>365*86400000).length;
 $('valveDirectoryPanel').hidden=Boolean(room);$('valveRegisterPanel').hidden=!room;$('valvePageTitle').textContent=room?room.replace(/ Plant Room$/i,'')+' Valve Register':'Valve Register';$('valvePageDescription').textContent=room?'Select a valve to view what it is, what it does and its normal position.':'Choose a plant room to open its dedicated valve register.';
 if(!room){body.innerHTML='';return}
 const rows=filteredValveRows();$('valveRoomTitle').textContent=room;$('valveRoomCount').textContent=`${rows.length} valve${rows.length===1?'':'s'} shown · ${valveRecords.filter(v=>samePlantRoom(v.plant_room,room)).length} registered`;
 body.innerHTML=rows.length?rows.map(v=>`<button type="button" class="valveRecordCard" data-valve-detail="${esc(v.id)}"><span class="valveCardTop"><b>${esc(valveNumberLabel(v))}</b><span class="valvePosition ${valvePositionClass(v.normal_position)}">${esc(v.normal_position||'To confirm')}</span></span><strong>${esc(v.isolation_purpose||v.service_duty||'Function to confirm')}</strong><small>${esc([v.size,v.valve_type].filter(Boolean).join(' · ')||'Type and size to confirm')}</small></button>`).join(''):'<p class="emptyState">No valves match the filters for this plant room.</p>'}
function valveDetailRows(v){return [['Physical label',valveNumberLabel(v)],['Plant room',v.plant_room],['Size',v.size],['Valve type',v.valve_type],['Service / system',v.service_duty],['What it does',v.isolation_purpose],['Normal position',v.normal_position],['Exact location',v.location],['Linked asset',v.asset_code],['Last verified',v.last_verified],['Notes',v.notes]].filter(([,value])=>value)}
function valveRecordUrl(v){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('valve',v.tag||v.id);if(v.plant_room)u.searchParams.set('room',v.plant_room);return u.toString()}
function openValveDetail(id){const v=valveRecords.find(x=>String(x.id)===String(id));if(!v)return;currentValveDetailId=String(v.id);$('valveDetailTitle').textContent=valveNumberLabel(v);$('valveDetailRoom').textContent=v.plant_room||'Plant room to confirm';$('valveDetailBody').innerHTML=valveDetailRows(v).map(([label,value])=>`<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');$('valveDetailQr').hidden=true;$('valveQrCode').innerHTML='';const list=filteredValveRows(),idx=list.findIndex(x=>String(x.id)===String(v.id));$('previousValve').disabled=idx<=0;$('nextValve').disabled=idx<0||idx>=list.length-1;openOpsModal('valveDetailModal')}
function stepValveDetail(direction){const list=filteredValveRows(),idx=list.findIndex(x=>String(x.id)===String(currentValveDetailId)),next=list[idx+direction];if(next)openValveDetail(next.id)}
function showValveQr(){const v=valveRecords.find(x=>String(x.id)===String(currentValveDetailId));if(!v)return;const box=$('valveQrCode');box.innerHTML='';$('valveDetailQr').hidden=false;if(typeof QRCode==='undefined')box.textContent='QR library could not load.';else new QRCode(box,{text:valveRecordUrl(v),width:220,height:220,correctLevel:QRCode.CorrectLevel.M})}
function openValveFromUrl(){const params=new URLSearchParams(location.search),key=params.get('valve');if(!key)return;const room=params.get('room')||'',v=valveRecords.find(x=>String(x.tag)===key||String(x.id)===key);if(v){showView('valves');openValveRoomRegister(room||v.plant_room);openValveDetail(v.id)}}
function openValve(id=''){editingValveId=id;const v=valveRecords.find(x=>String(x.id)===String(id))||{};$('valveModalTitle').textContent=id?'Edit valve':'Add valve';$('vTag').value=v.tag||'';$('vRoom').value=v.plant_room||$('valveRoom').value||$('vRoom').options[0]?.value||'';$('vAsset').value=v.asset_code||'';$('vService').value=v.service_duty||'';$('vType').value=v.valve_type||'';$('vSize').value=v.size||'';$('vPosition').value=v.normal_position||'Open';$('vVerified').value=v.last_verified||'';$('vLocation').value=v.location||'';$('vIsolation').value=v.isolation_purpose||'';$('vNotes').value=v.notes||'';$('deleteValve').hidden=!id;openOpsModal('valveModal')}
async function saveValveRecord(){const existing=valveRecords.find(x=>String(x.id)===String(editingValveId));const rec={id:existing?.id||`local-${Date.now()}`,tag:$('vTag').value.trim(),plant_room:$('vRoom').value,asset_code:$('vAsset').value||null,service_duty:$('vService').value.trim(),valve_type:$('vType').value.trim(),size:$('vSize').value.trim(),normal_position:$('vPosition').value,last_verified:$('vVerified').value||null,location:$('vLocation').value.trim(),isolation_purpose:$('vIsolation').value.trim(),notes:$('vNotes').value.trim(),updated_at:new Date().toISOString()};if(!rec.tag)return alert('Enter a valve tag.');if(operationsCloudReady){const payload={...rec};if(String(payload.id).startsWith('local-'))delete payload.id;payload.updated_by=session.user.id;const q=existing?client.from('valve_register').update(payload).eq('id',existing.id):client.from('valve_register').insert(payload);const {data,error}=await q.select().single();if(error)return alert(error.message);if(existing)Object.assign(existing,data);else valveRecords.push(data)}else{if(existing)Object.assign(existing,rec);else valveRecords.push(rec);saveOpsLocal()}closeOpsModal('valveModal');renderValves()}
async function deleteValveRecord(){if(!editingValveId||!confirm('Delete this valve record?'))return;if(operationsCloudReady){const {error}=await client.from('valve_register').delete().eq('id',editingValveId);if(error)return alert(error.message)}valveRecords=valveRecords.filter(x=>String(x.id)!==String(editingValveId));saveOpsLocal();closeOpsModal('valveModal');renderValves()}
function openOpsModal(id){const m=$(id);m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function closeOpsModal(id){const m=$(id);m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
function csvDownload(name,headers,rows){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[headers.map(q).join(','),...rows.map(r=>r.map(q).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function exportPpmCsv(){csvDownload('Limewood-PPM-Register.csv',['Asset ID','Asset','Plant room','Frequency','Last completed','Next due','Status','Assigned to','Task','Notes'],ppmRecords.map(r=>{const a=assetForCode(r.asset_code);return[r.asset_code,a?.name,a?.room,r.frequency,r.last_completed,r.next_due,ppmStatus(r),r.assigned_to,r.task,r.notes]}))}
function exportValveCsv(){csvDownload('Limewood-Valve-Register.csv',['Tag','Plant room','Linked asset','Service duty','Type','Size','Normal position','Location','Isolation purpose','Last verified','Notes'],valveRecords.map(v=>[v.tag,v.plant_room,v.asset_code,v.service_duty,v.valve_type,v.size,v.normal_position,v.location,v.isolation_purpose,v.last_verified,v.notes]))}

function setSync(text, error=false) {
  els.sync.textContent = text;
  els.sync.classList.toggle('error', error);
}

function localPhoto(asset) {
  const base = staticByCode.get(asset.asset_code);
  if (!base?.photo) return 'assets/images/asset-placeholder.svg';
  let folder = 'coach-house';
  if ((asset.room || '').startsWith('Staff')) folder = 'staff-house';
  if ((asset.room || '').startsWith('Main')) folder = 'main-house';
  if ((asset.room || '').startsWith('Forest Lodges')) folder = 'forest-lodges';
  return base.photo ? `assets/images/${folder}/${base.photo}` : 'assets/images/asset-placeholder.svg';
}

function toView(row) {
  const pr = plantRooms.find(r => r.id === row.plant_room_id);
  return {
    uuid: row.id,
    id: row.asset_code,
    name: row.asset_name,
    room: pr?.name || 'To be confirmed',
    category: row.category || 'Uncategorised',
    system: row.system_duty || '',
    manufacturer: row.manufacturer || '',
    model: row.model || '',
    serial: row.serial_number || '',
    status: row.operational_status || 'Needs review',
    condition: row.condition || 'Unknown',
    criticality: row.criticality || 'Medium',
    electricalIsolation: row.electrical_isolation || '',
    mechanicalIsolation: row.mechanical_isolation || '',
    isolationProcedure: row.emergency_isolation || '',
    ppm: row.ppm_frequency || '',
    notes: row.notes || '',
    manufacturerUrl: row.manufacturer_url || '',
    manualUrl: row.manual_url || '',
    photos: row.photos || [],
    documents: row.documents || [],
    raw: row
  };
}

async function signedUrl(path, expires=3600) {
  const { data, error } = await client.storage.from(cfg.storageBucket).createSignedUrl(path, expires);
  if (error) return '';
  return data.signedUrl;
}

async function loadCloud() {
  setSync('Syncing…');
  const [bRes, pRes, aRes, phRes, dRes] = await Promise.all([
    client.from('buildings').select('*').order('name'),
    client.from('plant_rooms').select('*').order('name'),
    client.from('assets').select('*').order('asset_code'),
    client.from('asset_photos').select('*').order('sort_order'),
    client.from('asset_documents').select('*').order('created_at')
  ]);
  const error = bRes.error || pRes.error || aRes.error || phRes.error || dRes.error;
  if (error) throw error;
  buildings = bRes.data || [];
  plantRooms = pRes.data || [];
  const photos = phRes.data || [];
  const docs = dRes.data || [];
  const photoUrls = await Promise.all(photos.map(async p => ({...p, url: await signedUrl(p.storage_path)})));
  const docUrls = await Promise.all(docs.map(async d => ({...d, url: d.external_url || (d.storage_path ? await signedUrl(d.storage_path) : '')})));
  assets = (aRes.data || []).map(row => toView({
    ...row,
    photos: photoUrls.filter(p => p.asset_id === row.id),
    documents: docUrls.filter(d => d.asset_id === row.id)
  }));
  setSync(`Cloud synced · ${assets.length} assets`);
  populateFilters(); updateStats(); render();
}


async function loadDocumentCentre() {
  // The main document table is the dependable core. SOP control tables are optional,
  // so a missing migration no longer prevents the whole app from starting.
  const docRes = await client.from('asset_documents').select('*').order('created_at', {ascending:false});
  if (docRes.error) throw docRes.error;

  const [sopRes, revRes, linkRes] = await Promise.all([
    client.from('sops').select('*').order('created_at', {ascending:false}),
    client.from('sop_revisions').select('*').order('created_at', {ascending:false}),
    client.from('asset_sops').select('*')
  ]);
  const sopTablesReady = !sopRes.error && !revRes.error && !linkRes.error;
  const revisions = sopTablesReady ? (revRes.data || []) : [];
  const links = sopTablesReady ? (linkRes.data || []) : [];

  const ordinary = await Promise.all((docRes.data || []).map(async d => {
    const rawTitle = d.title || 'Untitled document';
    const parts = rawTitle.split(' · ');
    const looksNumbered = parts.length > 1 && /^(SOP|RAMS|MAN|CERT|DRG|REP|ISO)[-_ ]?/i.test(parts[0]);
    return {
      key:`document-${d.id}`, source:'asset_documents', id:d.id, type:d.document_type || 'other',
      number:looksNumbered ? parts.shift() : '', title:parts.join(' · ') || rawTitle,
      category:'General', revision:d.revision || '', status:'approved', buildingId:'', plantRoomId:'',
      assetIds:d.asset_id ? [d.asset_id] : [], createdAt:d.created_at,
      url:d.external_url || (d.storage_path ? await signedUrl(d.storage_path) : ''), raw:d
    };
  }));

  const sops = sopTablesReady ? await Promise.all((sopRes.data || []).map(async row => {
    const rev = revisions.find(r => r.sop_id === row.id && r.revision === row.revision) || revisions.find(r => r.sop_id === row.id);
    const path = row.current_file_path || rev?.file_path || '';
    return {
      key:`sop-${row.id}`, source:'sops', id:row.id, type:'sop', number:row.sop_number, title:row.title,
      category:row.category || 'General', revision:row.revision || '1', status:row.status || 'draft', buildingId:row.building_id || '',
      plantRoomId:row.plant_room_id || '', assetIds:links.filter(x=>x.sop_id===row.id).map(x=>x.asset_id), createdAt:row.created_at,
      url:path ? await signedUrl(path) : '', raw:row
    };
  })) : [];

  sopRecords = sops;
  libraryDocuments = [...sops, ...ordinary].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  populateDocumentFilters();
  renderDocuments(); updateStats();
  if (!sopTablesReady) console.warn('Controlled SOP tables are unavailable. SOP uploads will use the standard document library fallback.');
}

function documentTypeLabel(type) {
  return ({sop:'SOP',rams:'RAMS',manual:'Manual',isolation_procedure:'Isolation procedure',schematic:'Schematic',drawing:'Drawing',certificate:'Certificate',report:'Report',other:'Other'})[type] || type || 'Document';
}

function populateDocumentFilters() {
  const current = docEls.buildingFilter.value;
  docEls.buildingFilter.innerHTML = '<option value="">All buildings</option>' + buildings.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  if (buildings.some(b=>b.id===current)) docEls.buildingFilter.value=current;
  docEls.building.innerHTML = '<option value="">No building selected</option>' + buildings.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  docEls.asset.innerHTML = '<option value="">No asset selected</option>' + assets.map(a=>`<option value="${esc(a.uuid)}">${esc(a.id)} · ${esc(a.name)}</option>`).join('');
  updateDocumentPlantRooms();
}

function updateDocumentPlantRooms() {
  const buildingId = docEls.building.value;
  const rooms = buildingId ? plantRooms.filter(r=>r.building_id===buildingId) : plantRooms;
  docEls.plantRoom.innerHTML = '<option value="">No plant room selected</option>' + rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
}

function filteredDocuments() {
  const q=docEls.search.value.trim().toLowerCase(), type=docEls.typeFilter.value, building=docEls.buildingFilter.value, status=docEls.statusFilter.value;
  return libraryDocuments.filter(d=>{
    const buildingName=buildings.find(b=>b.id===d.buildingId)?.name || '';
    const hay=[d.number,d.title,d.category,d.revision,d.type,d.status,buildingName].join(' ').toLowerCase();
    return (!q||hay.includes(q)) && (!type||d.type===type) && (!building||d.buildingId===building) && (!status||d.status===status);
  });
}

function renderDocuments() {
  if (!docEls.grid) return;
  const rows=filteredDocuments();
  docEls.count.textContent=`${rows.length} document${rows.length===1?'':'s'}`;
  docEls.grid.innerHTML=rows.map(d=>{
    const building=buildings.find(b=>b.id===d.buildingId)?.name || '';
    const assetNames=d.assetIds.map(id=>assets.find(a=>a.uuid===id)?.id).filter(Boolean).join(', ');
    const open=d.url ? `<a class="documentOpen" href="${esc(d.url)}" target="_blank" rel="noopener">Open document</a>` : '<span class="documentUnavailable">File unavailable</span>';
    return `<article class="documentCard"><div class="documentCardTop"><span class="documentType">${esc(documentTypeLabel(d.type))}</span><span class="documentStatus ${esc(d.status)}">${esc((d.status||'approved').replace('_',' '))}</span></div><h4>${esc(d.title)}</h4><p class="documentNumber">${esc(d.number || 'No document number')}</p><dl><div><dt>Category</dt><dd>${esc(d.category||'General')}</dd></div><div><dt>Revision</dt><dd>${esc(d.revision||'—')}</dd></div><div><dt>Building</dt><dd>${esc(building||'Estate-wide')}</dd></div><div><dt>Related asset</dt><dd>${esc(assetNames||'None')}</dd></div></dl>${open}</article>`;
  }).join('') || '<div class="emptyState">No documents match those filters.</div>';
}

function showDocuments(type='') {
  documentTypeContext=type || '';
  showView('documents');
  docEls.typeFilter.value=documentTypeContext;
  const labels={sop:'SOP Library',rams:'RAMS Library',manual:'Manufacturer Manuals',schematic:'Hydraulic Schematics',report:'Reports'};
  docEls.title.textContent=labels[documentTypeContext] || 'Document Centre';
  renderDocuments(); closeDrawer();
}

function openDocumentUpload() {
  docEls.type.value=documentTypeContext || 'sop';
  docEls.number.value=''; docEls.docTitle.value=''; docEls.category.value=''; docEls.revision.value='1'; docEls.status.value='draft';
  docEls.author.value=''; docEls.approvedBy.value=''; docEls.issueDate.value=''; docEls.reviewDate.value=''; docEls.building.value='';
  updateDocumentPlantRooms(); docEls.asset.value=''; docEls.description.value=''; docEls.changeSummary.value=''; docEls.file.value=''; docEls.message.textContent='';
  docEls.modal.classList.add('open'); docEls.modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
}

function closeDocumentUpload() { docEls.modal.classList.remove('open'); docEls.modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); }

async function uploadLibraryFile(path,file) {
  const {error}=await client.storage.from(cfg.storageBucket).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
  if(error) throw error;
}

function friendlyUploadError(error) {
  const message=String(error?.message || error || 'Upload failed.');
  if (/row-level security|violates row-level security/i.test(message)) return 'Supabase blocked the upload. Check the authenticated-user policies for the asset-files bucket and document tables.';
  if (/bucket.*not found|not found.*bucket/i.test(message)) return 'The Supabase storage bucket is missing. It must be named asset-files.';
  if (/payload too large|maximum allowed size|file size/i.test(message)) return 'That file is too large for the current Supabase upload limit.';
  if (/duplicate key|unique constraint/i.test(message)) return 'That document number and revision already exist.';
  return message;
}

async function removeUploadedFile(path) {
  if (!path) return;
  try { await client.storage.from(cfg.storageBucket).remove([path]); } catch (error) { console.warn('Could not clean up failed upload', error); }
}

async function saveStandardDocument({file,type,title,number,path}) {
  const allowed=['sop','manual','isolation_procedure','rams','schematic','drawing','certificate','report','other'];
  const dbType=allowed.includes(type)?type:'other';
  const decoratedTitle=[number,title].filter(Boolean).join(' · ');
  const {error}=await client.from('asset_documents').insert({
    asset_id:docEls.asset.value||null,
    title:decoratedTitle,
    document_type:dbType,
    storage_path:path,
    revision:docEls.revision.value.trim()||null,
    uploaded_by:session.user.id
  });
  if(error) throw error;
}

async function saveControlledSop({file,title,number,path}) {
  const revision=docEls.revision.value.trim()||'1';
  let sop;
  const {data:existing,error:lookupError}=await client.from('sops').select('*').eq('sop_number',number).maybeSingle();
  if(lookupError) throw lookupError;

  const payload={
    sop_number:number,title,category:docEls.category.value.trim()||'General',description:docEls.description.value.trim()||null,
    revision,status:docEls.status.value,author:docEls.author.value.trim()||null,approved_by:docEls.approvedBy.value.trim()||null,
    issue_date:docEls.issueDate.value||null,review_date:docEls.reviewDate.value||null,building_id:docEls.building.value||null,
    plant_room_id:docEls.plantRoom.value||null,current_file_path:path,current_file_name:file.name,current_file_type:file.type||null,
    updated_by:session.user.id
  };

  if(existing) {
    const {data,error}=await client.from('sops').update(payload).eq('id',existing.id).select('*').single();
    if(error) throw error; sop=data;
  } else {
    const {data,error}=await client.from('sops').insert({...payload,created_by:session.user.id}).select('*').single();
    if(error) throw error; sop=data;
  }

  const {data:existingRevision,error:revisionLookupError}=await client.from('sop_revisions').select('id').eq('sop_id',sop.id).eq('revision',revision).maybeSingle();
  if(revisionLookupError) throw revisionLookupError;
  if(existingRevision) throw new Error(`Revision ${revision} already exists for ${number}. Enter a new revision number.`);

  const {error:revError}=await client.from('sop_revisions').insert({
    sop_id:sop.id,revision,file_path:path,file_name:file.name,file_type:file.type||null,
    change_summary:docEls.changeSummary.value.trim()||null,uploaded_by:session.user.id
  });
  if(revError) throw revError;

  if(docEls.asset.value) {
    const {error:linkError}=await client.from('asset_sops').upsert({asset_id:docEls.asset.value,sop_id:sop.id},{onConflict:'asset_id,sop_id'});
    if(linkError) throw linkError;
  }
}

async function saveLibraryDocument() {
  let uploadedPath='';
  try {
    const file=docEls.file.files[0];
    const type=docEls.type.value;
    const title=docEls.docTitle.value.trim();
    const number=docEls.number.value.trim();
    if(!title) throw new Error('Document title is required.');
    if(!file) throw new Error('Select a file to upload.');
    if(type==='sop' && !number) throw new Error('An SOP number is required.');
    if(file.size > 50 * 1024 * 1024) throw new Error('Please keep each document below 50 MB.');

    docEls.save.disabled=true; docEls.save.textContent='Uploading…';
    docEls.message.classList.remove('success');
    docEls.message.textContent=`Uploading ${file.name}…`;

    const folder=type==='sop' ? `sops/${cleanName(number)}` : `documents/${cleanName(type||'other')}/${crypto.randomUUID()}`;
    uploadedPath=`${folder}/${Date.now()}-${crypto.randomUUID()}-${cleanName(file.name)}`;
    await uploadLibraryFile(uploadedPath,file);
    docEls.message.textContent='File uploaded. Saving document details…';

    if(type==='sop') {
      try {
        await saveControlledSop({file,title,number,path:uploadedPath});
      } catch(sopError) {
        // Missing optional controlled-document tables must not make SOP upload unusable.
        if (/relation .* does not exist|schema cache|could not find the table|404/i.test(String(sopError?.message||sopError))) {
          await saveStandardDocument({file,type,title,number,path:uploadedPath});
        } else throw sopError;
      }
    } else {
      await saveStandardDocument({file,type,title,number,path:uploadedPath});
    }

    docEls.message.classList.add('success');
    docEls.message.textContent='Upload complete.';
    await loadCloud(); await loadDocumentCentre();
    closeDocumentUpload(); showDocuments(documentTypeContext || type);
    alert(`${documentTypeLabel(type)} uploaded to the shared Document Centre.`);
  } catch(error) {
    console.error(error);
    await removeUploadedFile(uploadedPath);
    docEls.message.classList.remove('success');
    docEls.message.textContent=friendlyUploadError(error);
  } finally {
    docEls.save.disabled=false; docEls.save.textContent='Upload to Document Centre';
  }
}

function roomBuildingName(room) {
  if (room.startsWith('Main House')) return 'Main House';
  if (room.startsWith('Staff House')) return 'Staff House';
  if (room.startsWith('Coach House')) return 'Coach House';
  if (room.startsWith('Spa')) return 'Spa';
  if (room.startsWith('Pavilion')) return 'Pavilion';
  if (room.startsWith('Barn')) return 'Barn';
  if (room.startsWith('Forest Cottage')) return 'Forest Cottage';
  return room.replace(/ Plant Room$/,'') || 'Main House';
}

async function ensurePlantRoom(roomName) {
  let room = plantRooms.find(r => r.name === roomName);
  if (room) return room;

  const buildingName = roomBuildingName(roomName);
  let building = buildings.find(b => b.name === buildingName);

  if (!building) {
    const { data: existingBuilding, error: lookupError } = await client
      .from('buildings')
      .select('*')
      .eq('name', buildingName)
      .maybeSingle();

    if (lookupError) throw lookupError;
    building = existingBuilding;

    if (!building) {
      const { data, error } = await client
        .from('buildings')
        .upsert(
          { name: buildingName, survey_status: 'survey_in_progress' },
          { onConflict: 'name' }
        )
        .select('*')
        .single();

      if (error) throw error;
      building = data;
    }

    if (!buildings.some(b => b.id === building.id)) buildings.push(building);
  }

  const { data: existingRoom, error: roomLookupError } = await client
    .from('plant_rooms')
    .select('*')
    .eq('building_id', building.id)
    .eq('name', roomName)
    .maybeSingle();

  if (roomLookupError) throw roomLookupError;
  room = existingRoom;

  if (!room) {
    const { data, error } = await client
      .from('plant_rooms')
      .upsert(
        {
          building_id: building.id,
          name: roomName,
          survey_status: 'survey_in_progress'
        },
        { onConflict: 'building_id,name' }
      )
      .select('*')
      .single();

    if (error) throw error;
    room = data;
  }

  if (!plantRooms.some(r => r.id === room.id)) plantRooms.push(room);
  return room;
}

function localSaved(code) {
  try { return JSON.parse(localStorage.getItem(`lw-${code}`) || '{}'); } catch { return {}; }
}

async function seedExistingAssets() {
  if (staticBase.length === 0) return;
  const { data: existing, error } = await client.from('assets').select('asset_code');
  if (error) throw error;
  const existingCodes = new Set((existing || []).map(a => a.asset_code));
  const missingAssets = staticBase.filter(a => !existingCodes.has(a.id));
  if (missingAssets.length === 0) return;
  setSync(`Importing ${missingAssets.length} new assets…`);
  const uniqueRooms = [...new Set(missingAssets.map(a => a.room).filter(Boolean))];
  for (const roomName of uniqueRooms) await ensurePlantRoom(roomName);
  const userId = session.user.id;
  const rows = missingAssets.map(a => {
    const saved = localSaved(a.id);
    const merged = {...a, ...saved};
    const pr = plantRooms.find(r => r.name === merged.room);
    return {
      asset_code: merged.id,
      asset_name: merged.name || merged.id,
      building_id: pr?.building_id || null,
      plant_room_id: pr?.id || null,
      category: merged.category || null,
      system_duty: merged.system || merged.serviceDuty || null,
      manufacturer: merged.manufacturer || null,
      model: merged.model || null,
      serial_number: merged.serial || null,
      operational_status: merged.status || 'Needs review',
      condition: merged.condition || 'Unknown',
      criticality: merged.criticality || 'Medium',
      electrical_isolation: merged.electricalIsolation || null,
      mechanical_isolation: merged.mechanicalIsolation || null,
      emergency_isolation: merged.isolationProcedure || null,
      manufacturer_url: merged.link || null,
      manual_url: merged.manualUrl || null,
      ppm_frequency: merged.ppm || null,
      notes: merged.notes || null,
      created_by: userId,
      updated_by: userId
    };
  });
  const { error: upsertError } = await client.from('assets').upsert(rows, {onConflict:'asset_code'});
  if (upsertError) throw upsertError;
}

function isMissing(a) {
  const unknown = v => !v || /to be confirmed|unknown|not assessed|manual to be added/i.test(v);
  return ['manufacturer','model','serial','electricalIsolation','mechanicalIsolation'].some(k => unknown(a[k]));
}

function populateFilters() {
  const currentRoom = els.room.value, currentCategory = els.category.value;
  const rooms = [...new Set(assets.map(a=>canonicalPlantRoomName(a.room)).filter(Boolean))].sort();
  const cats = [...new Set(assets.map(a => a.category))].sort();
  els.room.innerHTML = '<option value="">All plant rooms</option>' + rooms.map(x => `<option>${esc(x)}</option>`).join('');
  els.category.innerHTML = '<option value="">All categories</option>' + cats.map(x => `<option>${esc(x)}</option>`).join('');
  if (rooms.includes(currentRoom)) els.room.value = currentRoom;
  if (cats.includes(currentCategory)) els.category.value = currentCategory;
  refreshPlantRoomNav();
}

function updateStats() {
  els.totalCount.textContent = assets.length;
  els.roomsCount.textContent = new Set(assets.map(a => a.room)).size;
  els.surveyedCount.textContent = assets.filter(a => ['Surveyed','Verified','Operational'].includes(a.status)).length;
  els.reviewCount.textContent = assets.filter(a => ['Needs review','Limited access'].includes(a.status)).length;
  els.photoCount.textContent = assets.reduce((n,a) => n + a.photos.length, 0);
  const setCount = (id, room) => { const el=$(id); if(el) el.textContent=`${assets.filter(a=>samePlantRoom(a.room,room)).length} assets`; };
  setCount('mainCount','Main House Plant Room'); setCount('staffCount','Staff House Plant Room'); setCount('coachCount','Coach House Plant Room'); setCount('forestCount','Forest Lodges Plant Room');
  const missing=assets.filter(isMissing).length;
  const critical=assets.filter(a=>['high','critical'].includes(String(a.criticality||'').toLowerCase())).length;
  if(els.missingCount) els.missingCount.textContent=missing;
  if(els.criticalCount) els.criticalCount.textContent=critical;
  if(els.dashboardDocumentCount) els.dashboardDocumentCount.textContent=libraryDocuments.length;
  const complete=assets.length ? Math.round(((assets.length-missing)/assets.length)*100) : 0;
  if(els.qualityPercent){els.qualityPercent.textContent=`${complete}%`; const ring=els.qualityPercent.closest('.qualityRing'); if(ring) ring.style.setProperty('--quality',`${complete}%`);}
  renderRecentActivity();
}

function renderRecentActivity() {
  if(!els.recentActivity) return;
  const assetEvents=assets.map(a=>({type:'asset',title:`${a.id} · ${a.name}`,detail:`${a.room} · ${a.status}`,date:a.raw?.updated_at||a.raw?.created_at||'',icon:'⚙️'}));
  const documentEvents=libraryDocuments.map(d=>({type:'document',title:d.title||'Document uploaded',detail:`${documentTypeLabel(d.type)}${d.number?' · '+d.number:''}`,date:d.createdAt||'',icon:'📄'}));
  const rows=[...assetEvents,...documentEvents].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
  els.recentActivity.innerHTML=rows.length?rows.map(x=>`<div class="activityItem"><span class="activityIcon">${x.icon}</span><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><time>${x.date?new Date(x.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'Current'}</time></div>`).join(''):'<p class="emptyState">No recent activity recorded yet.</p>';
}

function filtered() {
  const q = els.search.value.trim().toLowerCase();
  return assets.filter(a => {
    const hay = [a.id,a.name,a.room,a.category,a.system,a.manufacturer,a.model,a.serial,a.notes].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!els.room.value || samePlantRoom(a.room,els.room.value)) && (!els.category.value || a.category === els.category.value) && (!els.completeness.value || (els.completeness.value === 'missing' ? isMissing(a) : !isMissing(a)));
  });
}

function cardImage(a) { return a.photos[0]?.url || localPhoto(a); }

function render() {
  visibleRows = filtered();
  els.resultCount.textContent = `${visibleRows.length} asset${visibleRows.length===1?'':'s'}`;
  els.grid.innerHTML = visibleRows.map(a => `<article class="card" tabindex="0" data-id="${esc(a.id)}"><img src="${esc(cardImage(a))}" alt="${esc(a.name)}" onerror="this.src='assets/images/asset-placeholder.svg'"><div class="cardBody"><div class="topline"><span class="badge">${esc(a.id)}</span><span class="status">${esc(a.status)}</span></div><h4>${esc(a.name)}</h4><div class="meta">${esc(a.room)}<br>${esc(a.manufacturer || 'Manufacturer to confirm')} · ${esc(a.model || 'Model to confirm')}</div><button class="openAssetBtn" data-id="${esc(a.id)}">Open asset details</button></div></article>`).join('') || '<div class="emptyState">No assets match those filters.</div>';
}

function detailRows(a) {
  return [
    ['Plant room',a.room],['Category',a.category],['System / duty',a.system],['Manufacturer',a.manufacturer],['Model',a.model],['Serial number',a.serial],['Condition',a.condition],['Criticality',a.criticality],['Electrical isolation',a.electricalIsolation],['Mechanical isolation',a.mechanicalIsolation],['Isolation procedure',a.isolationProcedure],['PPM frequency',a.ppm]
  ];
}

function renderGallery() {
  const cloud = current?.photos || [];
  const local = localPhoto(current || {});
  const items = [...cloud.map(p => ({src:p.url, caption:p.caption || p.photo_type || 'Asset photograph'})), ...(local.includes('placeholder') ? [] : [{src:local,caption:'Original survey photograph'}])];
  els.gallery.innerHTML = items.length ? items.map(x => `<figure><img src="${esc(x.src)}" alt="${esc(x.caption)}"><figcaption>${esc(x.caption)}</figcaption></figure>`).join('') : '<figure><img src="assets/images/asset-placeholder.svg" alt="No photograph"><figcaption>No photograph uploaded</figcaption></figure>';
}

function renderLinks() {
  const links = [];
  if (current.manufacturerUrl) links.push(`<a href="${esc(current.manufacturerUrl)}" target="_blank" rel="noopener">Manufacturer website</a>`);
  if (current.manualUrl) links.push(`<a href="${esc(current.manualUrl)}" target="_blank" rel="noopener">Online manual</a>`);
  for (const d of current.documents || []) if (d.url) links.push(`<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)} · ${esc(d.document_type)}</a>`);
  els.links.innerHTML = links.join('') || '<small>No linked documents yet.</small>';
}

function renderDetails() {
  els.modalId.textContent = current.id || 'NEW';
  els.modalName.textContent = current.name || 'New asset';
  els.modalDetails.innerHTML = detailRows(current).map(([k,v]) => `<div><small>${esc(k)}</small>${esc(v || 'To be confirmed')}</div>`).join('');
  els.modalNotes.value = current.notes || '';
  els.modalStatus.value = current.status || 'Needs review';
  renderGallery(); renderLinks();
  if(els.assetQrBtn) els.assetQrBtn.hidden=!current.id;
  if(els.assetBmsBtn){ const key=bmsKeyForRoom(current.room); els.assetBmsBtn.hidden=!['staff','main','coach','spa','green','crescent','pavilion'].includes(key); els.assetBmsBtn.dataset.bmsKey=key; }
}

function setEditing(on) {
  editing = on;
  els.editPanel.hidden = !on;
  els.edit.textContent = on ? 'Cancel editing' : '✏️ Edit asset';
  if (on) {
    els.editFields.innerHTML = fields.map(([key,label]) => `<label>${esc(label)}<input data-field="${key}" value="${esc(current[key] || '')}"></label>`).join('');
    els.manufacturerLink.value = current.manufacturerUrl || '';
    els.manualLink.value = current.manualUrl || '';
  }
}

function openAsset(code) {
  current = assets.find(a => a.id === code);
  if (!current) return;
  setEditing(false); renderDetails();
  els.modal.classList.add('open'); els.modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  const i=visibleRows.findIndex(a=>a.id===current.id); els.previous.disabled=i<=0; els.next.disabled=i<0||i>=visibleRows.length-1;
}

function newAsset() {
  current = {uuid:null,id:'',name:'',room:els.room.value || 'Main House Plant Room',category:'',system:'',manufacturer:'',model:'',serial:'',status:'Needs review',condition:'Unknown',criticality:'Medium',electricalIsolation:'',mechanicalIsolation:'',isolationProcedure:'',ppm:'',notes:'',manufacturerUrl:'',manualUrl:'',photos:[],documents:[]};
  renderDetails(); setEditing(true); els.modal.classList.add('open'); els.modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); els.previous.disabled=true; els.next.disabled=true;
}

function closeAsset() { els.modal.classList.remove('open'); els.modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); current=null; }

function cleanName(name) { return name.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-'); }

async function uploadPhotos(assetUuid, files) {
  for (const file of files) {
    const path = `${assetUuid}/photos/${Date.now()}-${crypto.randomUUID()}-${cleanName(file.name)}`;
    const { error } = await client.storage.from(cfg.storageBucket).upload(path, file, {cacheControl:'3600',upsert:false,contentType:file.type});
    if (error) throw error;
    const { error: rowError } = await client.from('asset_photos').insert({asset_id:assetUuid,storage_path:path,caption:file.name,photo_type:'general',uploaded_by:session.user.id});
    if (rowError) throw rowError;
  }
}

async function uploadDocument(assetUuid, file, title, type) {
  const path = `${assetUuid}/documents/${Date.now()}-${crypto.randomUUID()}-${cleanName(file.name)}`;
  const { error } = await client.storage.from(cfg.storageBucket).upload(path, file, {cacheControl:'3600',upsert:false,contentType:file.type || 'application/octet-stream'});
  if (error) throw error;
  const { error: rowError } = await client.from('asset_documents').insert({asset_id:assetUuid,title:title || file.name,document_type:type || 'other',storage_path:path,uploaded_by:session.user.id});
  if (rowError) throw rowError;
}

async function saveCurrent() {
  if (!current) return;
  try {
    els.save.disabled=true; els.save.textContent='Saving…'; setSync('Saving to cloud…');
    current.notes=els.modalNotes.value.trim(); current.status=els.modalStatus.value;
    if (editing) {
      els.editFields.querySelectorAll('[data-field]').forEach(i => current[i.dataset.field]=i.value.trim());
      current.manufacturerUrl=els.manufacturerLink.value.trim(); current.manualUrl=els.manualLink.value.trim();
    }
    if (!current.id || !current.name) throw new Error('Asset ID and asset name are required.');
    const pr = await ensurePlantRoom(current.room || 'Main House Plant Room');
    const payload = {
      asset_code:current.id, asset_name:current.name, building_id:pr.building_id, plant_room_id:pr.id,
      category:current.category||null, system_duty:current.system||null, manufacturer:current.manufacturer||null,
      model:current.model||null, serial_number:current.serial||null, operational_status:current.status||'Needs review',
      condition:current.condition||'Unknown', criticality:current.criticality||'Medium', electrical_isolation:current.electricalIsolation||null,
      mechanical_isolation:current.mechanicalIsolation||null, emergency_isolation:current.isolationProcedure||null,
      manufacturer_url:current.manufacturerUrl||null, manual_url:current.manualUrl||null, ppm_frequency:current.ppm||null,
      notes:current.notes||null, updated_by:session.user.id
    };
    let uuid=current.uuid;
    if (uuid) {
      const {error}=await client.from('assets').update(payload).eq('id',uuid); if(error) throw error;
    } else {
      payload.created_by=session.user.id;
      const {data,error}=await client.from('assets').insert(payload).select('id').single(); if(error) throw error; uuid=data.id;
    }
    if (els.photos.files.length) await uploadPhotos(uuid,[...els.photos.files]);
    if (els.document.files[0]) await uploadDocument(uuid,els.document.files[0],els.docTitle.value.trim(),els.docType.value);
    await loadCloud(); current=assets.find(a=>a.uuid===uuid); renderDetails(); setEditing(false); alert('Asset saved to the shared cloud database.');
  } catch (error) {
    console.error(error); setSync('Save failed',true); alert(error.message || 'The asset could not be saved.');
  } finally { els.save.disabled=false; els.save.textContent='Save to cloud'; }
}

async function signIn() {
  const email=els.authEmail.value.trim();
  const password=els.authPassword.value;
  if(!email || !password){
    els.authMessage.textContent='Enter your email address and password.';
    return;
  }

  els.authMessage.textContent='Signing in…';
  els.signIn.disabled=true;

  let timeoutId;
  try {
    const timeout=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(new Error('Sign-in timed out after 15 seconds. The browser could not complete the Supabase authentication request.')),15000);
    });
    const result=await Promise.race([
      client.auth.signInWithPassword({email,password}),
      timeout
    ]);
    clearTimeout(timeoutId);

    if(result?.error) throw result.error;
    els.authMessage.textContent='Signed in. Loading Limewood Engineering…';
  } catch(error) {
    clearTimeout(timeoutId);
    console.error('Sign-in error:',error);
    const message=String(error?.message||error||'Unable to sign in.');
    if(/timed out/i.test(message)){
      els.authMessage.textContent='Sign-in timed out. Supabase did not respond. Check the connection, then try again.';
    } else if(/failed to fetch|network|load failed/i.test(message)){
      els.authMessage.textContent='Cannot reach Supabase. Check the internet connection or browser network access.';
    } else {
      els.authMessage.textContent=message;
    }
  } finally {
    els.signIn.disabled=false;
  }
}

async function signUp() {
  els.authMessage.textContent='Creating account…';
  const {data,error}=await client.auth.signUp({email:els.authEmail.value.trim(),password:els.authPassword.value,options:{emailRedirectTo:location.origin+location.pathname}});
  if(error) els.authMessage.textContent=error.message;
  else els.authMessage.textContent=data.session?'Account created and signed in.':'Account created. Check your email if confirmation is enabled.';
}

async function startApp(newSession) {
  session=newSession;
  els.authScreen.hidden=true; els.appShell.hidden=false;
  updateDashboardGreeting();
  try {
    // Load existing buildings and plant rooms before attempting the one-time asset import.
    // This prevents duplicate building and room inserts on a fresh deployment.
    await loadCloud();
    await seedExistingAssets();
    await loadCloud();
    refreshV6Metrics();
    await loadDocumentCentre();
    await loadOperations();
    await loadLogs();
    showView('dashboard');
    const directAsset=new URLSearchParams(location.search).get('asset'); if(directAsset&&assets.some(a=>a.id===directAsset)){showRegister('');setTimeout(()=>openAsset(directAsset),100);}
  }
  catch(error){
    console.error(error);
    const message=String(error?.message||'Cloud connection failed');
    if(/jwt issued at future|issued in the future|not before claim|nbf/i.test(message)){
      setSync('Device clock needs correcting',true);
      alert('Your phone date or time is incorrect. Turn on Automatic date and time in Android Settings, then close and reopen the app. Supabase cannot accept a login token while the device clock is behind.');
      return;
    }
    setSync(message,true);
    alert(`Supabase connection error: ${message}`);
  }
}


function updateDashboardGreeting(){
  const hour=new Date().getHours();
  const period=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const meta=session?.user?.user_metadata||{};
  let name=meta.full_name||meta.name||meta.display_name||meta.first_name||'';
  if(!name){
    const email=String(session?.user?.email||'').split('@')[0];
    name=email.replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  const first=String(name).trim().split(/\s+/)[0];
  const greeting=$('dashboardGreeting');
  if(greeting) greeting.textContent=`${period}${first?', '+first:''}. Here is what needs attention.`;
}

function stopApp() { session=null; assets=[]; els.appShell.hidden=true; els.authScreen.hidden=false; els.authPassword.value=''; els.authMessage.textContent=''; }

els.signIn.onclick=signIn; els.signUp.onclick=signUp; els.signOut.onclick=()=>client.auth.signOut(); els.refresh.onclick=()=>Promise.all([loadCloud(),loadDocumentCentre(),loadOperations(),loadLogs()]).catch(e=>{setSync(e.message,true);alert(e.message)});
els.grid.addEventListener('click',e=>{const t=e.target.closest('[data-id]');if(t)openAsset(t.dataset.id)});
els.grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.card')){e.preventDefault();openAsset(e.target.dataset.id)}});
els.edit.onclick=()=>setEditing(!editing); els.save.onclick=saveCurrent; els.addAsset.onclick=newAsset; els.close.onclick=closeAsset; els.back.onclick=closeAsset; els.modal.onclick=e=>{if(e.target===els.modal)closeAsset()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAsset()});
[els.search,els.room,els.category,els.completeness].forEach(x=>x.addEventListener('input',render));
function adjacent(n){const i=visibleRows.findIndex(a=>a.id===current?.id),a=visibleRows[i+n];if(a)openAsset(a.id)} els.previous.onclick=()=>adjacent(-1); els.next.onclick=()=>adjacent(1);


const runGlobalSearch=()=>{const q=els.globalSearch?.value.trim()||'';if(q)showGlobalSearchResults(q);};
$('globalSearchBtn')?.addEventListener('click',runGlobalSearch);
els.globalSearch?.addEventListener('keydown',e=>{if(e.key==='Enter')runGlobalSearch()});
$('quickAddAsset')?.addEventListener('click',()=>{showRegister('');newAsset()});
$('quickUploadSop')?.addEventListener('click',()=>{showDocuments('sop');openDocumentUpload()});
$('quickValveChart')?.addEventListener('click',()=>{showDocuments('drawing');docEls.type.value='drawing';openDocumentUpload();docEls.category.value='Valve chart'});
$('quickPlantRooms')?.addEventListener('click',showPlantRoomDirectory);
$('quickEstateRegister')?.addEventListener('click',showAssetRegisterDirectory);
$('quickMaintenanceIssues')?.addEventListener('click',showMaintenanceIssues);
$('quickPpm')?.addEventListener('click',showPpmDirectory);
$('quickLogs')?.addEventListener('click',showLogsHome);
$('quickValves')?.addEventListener('click',()=>{showView('valves');showValveDirectory()});
$('quickCompliance')?.addEventListener('click',showCompliance);
$('quickBms')?.addEventListener('click',()=>showView('bms'));
$('openBmsOverview')?.addEventListener('click',()=>openBms('overview'));
$('testBmsConnection')?.addEventListener('click',()=>{ const r=$('bmsTestResult'); r.textContent='Opening secure BMS connection…'; openBms('overview'); setTimeout(()=>r.textContent='If Niagara opened, the connection is available. If not, connect to the estate network or approved VPN.',700); });
document.querySelectorAll('[data-bms-key]').forEach(b=>b.addEventListener('click',()=>openBms(b.dataset.bmsKey)));
els.assetQrBtn?.addEventListener('click',()=>showQrForAsset(current));
els.assetBmsBtn?.addEventListener('click',()=>openBms(els.assetBmsBtn.dataset.bmsKey||'overview'));

$('metricPlantRooms')?.addEventListener('click',showPlantRoomDirectory);
$('metricAssets')?.addEventListener('click',showAssetRegisterDirectory);
$('metricValves')?.addEventListener('click',()=>{showView('valves');showValveDirectory()});
$('metricPpm')?.addEventListener('click',showPpmDirectory);
$('priorityReview')?.addEventListener('click',()=>{showRegister('');els.completeness.value='';els.search.value='';visibleRows=assets.filter(a=>['Needs review','Limited access'].includes(a.status));els.resultCount.textContent=`${visibleRows.length} assets needing review`;els.grid.innerHTML=visibleRows.map(a=>`<article class="card" tabindex="0" data-id="${esc(a.id)}"><img src="${esc(cardImage(a))}" alt="${esc(a.name)}"><div class="cardBody"><div class="topline"><span class="badge">${esc(a.id)}</span><span class="status">${esc(a.status)}</span></div><h4>${esc(a.name)}</h4><div class="meta">${esc(a.room)}</div></div></article>`).join('')});
$('priorityMissing')?.addEventListener('click',()=>{showRegister('');els.completeness.value='missing';render()});
$('priorityCritical')?.addEventListener('click',()=>{showRegister('');els.search.value='';visibleRows=assets.filter(a=>['high','critical'].includes(String(a.criticality||'').toLowerCase()));els.resultCount.textContent=`${visibleRows.length} critical assets`;els.grid.innerHTML=visibleRows.map(a=>`<article class="card" tabindex="0" data-id="${esc(a.id)}"><img src="${esc(cardImage(a))}" alt="${esc(a.name)}"><div class="cardBody"><div class="topline"><span class="badge">${esc(a.id)}</span><span class="status">${esc(a.criticality)}</span></div><h4>${esc(a.name)}</h4><div class="meta">${esc(a.room)}</div></div></article>`).join('')});
$('priorityDocuments')?.addEventListener('click',()=>showDocuments(''));

const dashboardView=$('dashboardView'),plantRoomHubView=$('plantRoomHubView'),registerView=$('registerView'),documentView=$('documentView'),complianceView=$('complianceView'),ppmView=$('ppmView'),logsView=$('logsView'),valveView=$('valveView'),maintenanceIssuesView=$('maintenanceIssuesView'),placeholderView=$('placeholderView'),registerTitle=$('registerTitle'),drawer=$('drawer'),backdrop=$('drawerBackdrop');
let currentHubRoom='';
function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true')}
function showView(n){dashboardView.hidden=n!=='dashboard';plantRoomHubView.hidden=n!=='plantRoomHub';registerView.hidden=n!=='register';documentView.hidden=n!=='documents';complianceView.hidden=n!=='compliance';ppmView.hidden=n!=='ppm';logsView.hidden=n!=='logs';valveView.hidden=n!=='valves';if(maintenanceIssuesView)maintenanceIssuesView.hidden=n!=='maintenanceIssues';$('bmsView').hidden=n!=='bms';placeholderView.hidden=n!=='placeholder'}

function allPlantRoomNames(){return allKnownPlantRooms();}
function refreshPlantRoomNav(){const nav=$('plantRoomNav');if(!nav)return;const rooms=allPlantRoomNames();nav.innerHTML=rooms.length?rooms.map(r=>`<button data-hub-room="${esc(r)}">${esc(r.replace(/ Plant Room$/,''))}</button>`).join(''):'<small class="emptyState">No plant rooms added yet.</small>'; }
function roomDocumentCount(room){const pr=plantRooms.find(r=>samePlantRoom(r.name,room));return libraryDocuments.filter(d=>String(d.plantRoomId||'')===String(pr?.id||'')||String(d.title||'').toLowerCase().includes(room.replace(/ Plant Room$/,'').toLowerCase())).length;}

function showAssetRegisterDirectory(){
  const rooms=allPlantRoomNames();
  const card=placeholderView.querySelector('.placeholderCard');
  card.innerHTML=`<span>ASSET REGISTERS</span><h2>Select a plant room</h2><p>Choose a plant room to open its equipment register.</p><div class="plantHubGrid directoryGrid">${rooms.length?rooms.map(r=>`<button data-select-asset-room="${esc(r)}"><span>📋</span><b>${esc(r.replace(/ Plant Room$/i,''))}</b><small>${assets.filter(a=>samePlantRoom(a.room,r)).length} asset${assets.filter(a=>samePlantRoom(a.room,r)).length===1?'':'s'}</small></button>`).join(''):'<p class="emptyState">No plant rooms have been added yet.</p>'}</div><button id="assetDirectoryAll">Open estate asset register</button>`;
  showView('placeholder');closeDrawer();
}
function showAboutPage(){
  const card=placeholderView.querySelector('.placeholderCard');
  card.innerHTML=`<span>ABOUT</span><h2>Limewood Engineering</h2><p>Engineering Control Centre</p><div class="aboutForge"><b>Powered by <a href=\"https://forgecompliance.co.uk\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"forge-link\">Forge Compliance</a></b><span>Built and managed by <a href=\"https://forgecompliance.co.uk\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"forge-link\">Forge Compliance</a> Ltd.</span><small>Version 7.1.3.3</small></div><button id="aboutBack">Return to dashboard</button>`;
  showView('placeholder');closeDrawer();
}
function showGlobalSearchResults(query=''){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return;
  const assetMatches=assets.filter(a=>[a.id,a.name,a.room,a.manufacturer,a.model,a.serial,a.category,a.system].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,12);
  const valveMatches=valveRecords.filter(v=>[v.tag,v.valve_no,v.plant_room,v.service_duty,v.isolation_purpose,v.valve_type,v.location].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,12);
  const docMatches=libraryDocuments.filter(d=>[d.title,d.number,d.type,d.category,d.description].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,12);
  const card=placeholderView.querySelector('.placeholderCard');
  card.innerHTML=`<span>ESTATE SEARCH</span><h2>Results for “${esc(query)}”</h2><p>${assetMatches.length} assets · ${valveMatches.length} valves · ${docMatches.length} documents</p><div class="globalResultGroups"><section><h3>Assets</h3>${assetMatches.length?assetMatches.map(a=>`<button data-global-asset="${esc(a.id)}"><b>${esc(a.id)} · ${esc(a.name)}</b><small>${esc(a.room)}</small></button>`).join(''):'<small>No asset matches</small>'}</section><section><h3>Valves</h3>${valveMatches.length?valveMatches.map(v=>`<button data-global-valve="${esc(v.id||v.tag)}"><b>${esc(v.tag||v.valve_no||'Valve')}</b><small>${esc(v.plant_room||'')} · ${esc(v.isolation_purpose||v.service_duty||'')}</small></button>`).join(''):'<small>No valve matches</small>'}</section><section><h3>Documents</h3>${docMatches.length?docMatches.map(d=>`<button data-global-doc="${esc(d.title||'')}"><b>${esc(d.title||'Document')}</b><small>${esc(documentTypeLabel(d.type))}</small></button>`).join(''):'<small>No document matches</small>'}</section></div><button id="searchBack">Return to dashboard</button>`;
  showView('placeholder');closeDrawer();
}
function refreshV6Metrics(){
  const due=ppmRecords.filter(p=>['Overdue','Due soon'].includes(ppmStatus(p))).length;
  if($('metricPlantRoomCount'))$('metricPlantRoomCount').textContent=allPlantRoomNames().length;
  if($('metricAssetCount'))$('metricAssetCount').textContent=assets.length;
  if($('metricValveCount'))$('metricValveCount').textContent=valveRecords.length;
  if($('metricPpmCount'))$('metricPpmCount').textContent=due;
}

function showPlantRoomDirectory(){
  const rooms=allPlantRoomNames();
  const card=placeholderView.querySelector('.placeholderCard');
  card.innerHTML=`<span>PLANT ROOMS</span><h2>Select a plant room</h2><p>Choose a plant room to open its engineering hub.</p><div class="plantHubGrid directoryGrid">${rooms.length?rooms.map(r=>`<button data-select-plant-room="${esc(r)}"><span>🏭</span><b>${esc(r.replace(/ Plant Room$/i,''))}</b><small>${assets.filter(a=>samePlantRoom(a.room,r)).length} assets · ${valveRecords.filter(v=>samePlantRoom(v.plant_room,r)).length} valves</small></button>`).join(''):'<p class="emptyState">No plant rooms have been added yet.</p>'}</div><button id="roomDirectoryBack">Return to dashboard</button>`;
  showView('placeholder');
  closeDrawer();
}

function showPlantRoomHub(room){currentHubRoom=canonicalPlantRoomName(room)||'Unassigned Plant Room';showView('plantRoomHub');$('hubRoomTitle').textContent=currentHubRoom;$('hubAssetCount').textContent=assets.filter(a=>samePlantRoom(a.room,currentHubRoom)).length;$('hubValveCount').textContent=valveRecords.filter(v=>samePlantRoom(v.plant_room,currentHubRoom)).length;$('hubPpmCount').textContent=ppmRecords.filter(p=>samePlantRoom(p.plant_room||assetForCode(p.asset_code)?.room,currentHubRoom)).length;$('hubDocumentCount').textContent=roomDocumentCount(currentHubRoom);$('hubRoomSummary').textContent='Choose assets, valves, PPM, QR labels, documents, compliance or live BMS for this room.';$('hubSearch').value='';closeDrawer();}
function printRoomQrLabels(room){if(typeof QRCode==='undefined')return alert('QR library could not load. Reload while connected to the internet.');const list=assets.filter(a=>samePlantRoom(a.room,room));if(!list.length)return alert('There are no assets in this plant room yet.');const w=open('','_blank');w.document.write('<title>'+esc(room)+' QR Labels</title><style>@page{size:A4;margin:8mm}body{font-family:Arial}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.label{border:1px solid #333;padding:8px;text-align:center;break-inside:avoid}.qr{width:110px;height:110px;margin:auto}.qr canvas,.qr img{width:110px!important;height:110px!important}h3{font-size:14px;margin:5px 0 2px}p{font-size:9px;margin:2px}</style><h2>'+esc(room)+'</h2><div class="sheet" id="sheet"></div>');const sheet=w.document.getElementById('sheet');list.forEach(a=>{const d=w.document.createElement('div');d.className='label';d.innerHTML=`<div class="qr"></div><h3>${esc(a.id)}</h3><p><b>${esc(a.name)}</b></p><p>${esc(a.room)}</p>`;sheet.appendChild(d);new QRCode(d.querySelector('.qr'),{text:assetUrl(a.id),width:110,height:110,correctLevel:QRCode.CorrectLevel.M});});w.document.write('<script>setTimeout(()=>print(),900)<\/script>');w.document.close();}
function openHubDocuments(type=''){showDocuments(type);const pr=plantRooms.find(r=>samePlantRoom(r.name,currentHubRoom));if(pr){const building=buildings.find(b=>b.id===pr.building_id);if(building){docEls.buildingFilter.value=building.id;renderDocuments();}}}

function showRegister(room=''){room=room?canonicalPlantRoomName(room):'';showView('register');els.room.value=room;registerTitle.textContent=room?room.replace(' Plant Room',' Asset Register'):'Estate Asset Register';render();closeDrawer()}
function placeholder(t){$('placeholderTitle').textContent=t;showView('placeholder');closeDrawer()}
$('menuBtn').onclick=()=>{drawer.scrollTop=0;drawer.classList.add('open');backdrop.classList.add('open');drawer.setAttribute('aria-hidden','false')}; $('closeDrawer').onclick=closeDrawer; backdrop.onclick=closeDrawer;

$('assetRegistersMenu')?.querySelector('summary')?.addEventListener('click',e=>{e.preventDefault();$('assetRegistersMenu').open=false;showAssetRegisterDirectory();});
$('plantRoomsMenu')?.querySelector('summary')?.addEventListener('click',e=>{
  e.preventDefault();
  $('plantRoomsMenu').open=false;
  showPlantRoomDirectory();
});
placeholderView.addEventListener('click',e=>{
  const roomButton=e.target.closest('[data-select-plant-room]'); if(roomButton)showPlantRoomHub(roomButton.dataset.selectPlantRoom);
  const assetRoom=e.target.closest('[data-select-asset-room]'); if(assetRoom)showRegister(assetRoom.dataset.selectAssetRoom);
  const assetHit=e.target.closest('[data-global-asset]'); if(assetHit){showRegister('');setTimeout(()=>openAsset(assetHit.dataset.globalAsset),50)}
  const valveHit=e.target.closest('[data-global-valve]'); if(valveHit)openValveDetail(valveHit.dataset.globalValve);
  const docHit=e.target.closest('[data-global-doc]'); if(docHit){showDocuments('');docEls.search.value=docHit.dataset.globalDoc;renderDocuments()}
  if(e.target.closest('#assetDirectoryAll'))showRegister('');
  if(e.target.closest('#roomDirectoryBack')||e.target.closest('#searchBack')||e.target.closest('#aboutBack'))showView('dashboard');
});


$('ppmRoomButtons')?.addEventListener('click',e=>{const b=e.target.closest('[data-ppm-room]');if(b)openPpmRoom(b.dataset.ppmRoom)});
$('backToPpmRooms')?.addEventListener('click',showPpmDirectory);
['ppmSearch','ppmStatus'].forEach(id=>$(id)?.addEventListener('input',renderPpm));
$('ppmCards')?.addEventListener('click',e=>{const b=e.target.closest('[data-ppm]');if(b)openPpm(b.dataset.ppm)});
$('addPpmSchedule')?.addEventListener('click',()=>{populatePpmAddForm();openOpsModal('ppmAddModal')});
$('closePpmAddModal')?.addEventListener('click',()=>closeOpsModal('ppmAddModal'));
$('createPpmSchedule')?.addEventListener('click',createPpmSchedule);


$('logTypeGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-log-type]');if(b)beginLog(b.dataset.logType)});
$('logBackTypes')?.addEventListener('click',showLogsHome);
$('cancelLog')?.addEventListener('click',showLogsHome);
$('dynamicLogForm')?.addEventListener('submit',saveDynamicLog);
$('logsHistoryBtn')?.addEventListener('click',showLogHistory);
$('logHistoryBack')?.addEventListener('click',showLogsHome);
$('logHistorySearch')?.addEventListener('input',renderLogHistory);
$('logHistoryType')?.addEventListener('change',renderLogHistory);

$('drawerNav').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.hubRoom){showPlantRoomHub(b.dataset.hubRoom)}else if(b.dataset.view==='dashboard'){showView('dashboard');closeDrawer()}else if(b.dataset.view==='compliance'){showCompliance()}else if(b.dataset.view==='bms'){showView('bms');closeDrawer()}else if(b.dataset.view==='maintenanceIssues'){showMaintenanceIssues();closeDrawer()}else if(b.dataset.view==='logs'){showLogsHome()}else if(b.dataset.view==='ppm'){showPpmDirectory()}else if(b.dataset.view==='valves'){showView('valves');showValveDirectory();closeDrawer()}else if(b.dataset.view==='search'){showView('dashboard');closeDrawer();setTimeout(()=>els.globalSearch?.focus(),150)}else if(b.dataset.view==='documents'){showDocuments(b.dataset.docType||'')}else if(b.dataset.view==='about'){showAboutPage()}else if('room'in b.dataset)showPlantRoomHub(b.dataset.room||'');else if(b.dataset.placeholder)placeholder(b.dataset.placeholder)};
document.querySelectorAll('[data-estate-room]').forEach(b=>b.onclick=()=>showPlantRoomHub(b.dataset.estateRoom)); document.querySelectorAll('.estateGrid [data-placeholder]').forEach(b=>b.onclick=()=>placeholder(b.dataset.placeholder)); $('backDashboard').onclick=()=>showView('dashboard');



$('hubBackDashboard')?.addEventListener('click',()=>showView('dashboard'));
$('hubSearchBtn')?.addEventListener('click',()=>{showRegister(currentHubRoom);els.search.value=$('hubSearch').value;render()});
$('hubSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('hubSearchBtn').click()});
$('plantRoomHubView')?.addEventListener('click',e=>{const b=e.target.closest('[data-hub-action]');if(!b)return;const a=b.dataset.hubAction;if(a==='assets')showRegister(currentHubRoom);else if(a==='valves'){showView('valves');openValveRoomRegister(currentHubRoom)}else if(a==='ppm'){openPpmRoom(currentHubRoom)}else if(a==='qr')printRoomQrLabels(currentHubRoom);else if(['sop','rams','manual','schematic'].includes(a))openHubDocuments(a);else if(a==='photos'){showRegister(currentHubRoom);els.search.value='';render()}else if(a==='compliance')showCompliance();else if(a==='bms'){showView('bms')}else if(a==='notes'){showRegister(currentHubRoom);els.search.value='';render()}});
$('uploadCompliance')?.addEventListener('click',()=>openComplianceUpload('Compliance'));
$('printAllQr')?.addEventListener('click',printAllQrLabels);
$('complianceGrid')?.addEventListener('click',e=>{const openBtn=e.target.closest('[data-compliance-open]'),up=e.target.closest('[data-compliance-upload]');if(openBtn){const r=complianceRegisters.find(x=>x.key===openBtn.dataset.complianceOpen);showDocuments('');docEls.search.value=r?.terms[0]||'';renderDocuments();}else if(up)openComplianceUpload(up.dataset.complianceUpload);});
$('closeQrModal')?.addEventListener('click',closeQr);$('qrModal')?.addEventListener('click',e=>{if(e.target.id==='qrModal')closeQr()});
$('downloadQr')?.addEventListener('click',()=>{const url=qrDataUrl();if(!url||!current)return;const a=document.createElement('a');a.href=url;a.download=`${cleanName(current.id)}-QR.png`;a.click();});
$('printQr')?.addEventListener('click',()=>{if(current)printQrAsset(current)});

docEls.add.onclick=openDocumentUpload; docEls.close.onclick=closeDocumentUpload; docEls.modal.onclick=e=>{if(e.target===docEls.modal)closeDocumentUpload()}; docEls.save.onclick=saveLibraryDocument;
docEls.building.onchange=updateDocumentPlantRooms;
docEls.type.onchange=()=>{ const isSop=docEls.type.value==='sop'; docEls.number.placeholder=isSop?'e.g. SOP-001':'Optional document number'; if(isSop&&!docEls.revision.value)docEls.revision.value='1'; };
docEls.file.onchange=()=>{ const file=docEls.file.files[0]; docEls.message.classList.remove('success'); docEls.message.textContent=file?`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB selected`:''; };
[docEls.search,docEls.typeFilter,docEls.buildingFilter,docEls.statusFilter].forEach(x=>x.addEventListener('input',renderDocuments));




['valveSearch','valveRoom','valvePosition'].forEach(id=>$(id)?.addEventListener('input',renderValves));
$('valveRoomButtons')?.addEventListener('click',e=>{const b=e.target.closest('[data-valve-room-card]');if(!b)return;openValveRoomRegister(b.dataset.valveRoomCard||'');});
$('backToValveRooms')?.addEventListener('click',showValveDirectory);

$('ppmRows')?.addEventListener('click',e=>{const b=e.target.closest('[data-ppm]');if(b)openPpm(b.dataset.ppm)});
$('valveRows')?.addEventListener('click',e=>{const b=e.target.closest('[data-valve-detail]');if(b)openValveDetail(b.dataset.valveDetail)});
$('importValves')?.addEventListener('click',openValveImport);$('addImportPlantRoom')?.addEventListener('click',()=>addPlantRoomFromUi('valveImportRoom'));$('addValvePlantRoom')?.addEventListener('click',()=>addPlantRoomFromUi('vRoom'));$('closeValveImport')?.addEventListener('click',()=>closeOpsModal('valveImportModal'));$('cancelValveImport')?.addEventListener('click',()=>closeOpsModal('valveImportModal'));$('valveImportFile')?.addEventListener('change',previewValveImport);$('valveImportRoom')?.addEventListener('change',()=>{if($('valveImportFile').files[0])previewValveImport()});$('confirmValveImport')?.addEventListener('click',confirmValveImport);$('valveImportModal')?.addEventListener('click',e=>{if(e.target.id==='valveImportModal')closeOpsModal('valveImportModal')});
$('addValve')?.addEventListener('click',()=>openValve());$('saveValve')?.addEventListener('click',saveValveRecord);$('deleteValve')?.addEventListener('click',deleteValveRecord);$('closeValveModal')?.addEventListener('click',()=>closeOpsModal('valveModal'));$('closeValveDetail')?.addEventListener('click',()=>closeOpsModal('valveDetailModal'));$('valveDetailModal')?.addEventListener('click',e=>{if(e.target.id==='valveDetailModal')closeOpsModal('valveDetailModal')});$('editValveFromDetail')?.addEventListener('click',()=>{const id=currentValveDetailId;closeOpsModal('valveDetailModal');openValve(id)});$('previousValve')?.addEventListener('click',()=>stepValveDetail(-1));$('nextValve')?.addEventListener('click',()=>stepValveDetail(1));$('valveQrButton')?.addEventListener('click',showValveQr);
$('savePpm')?.addEventListener('click',savePpmRecord);$('closePpmModal')?.addEventListener('click',()=>closeOpsModal('ppmModal'));
$('exportPpm')?.addEventListener('click',exportPpmCsv);$('exportValves')?.addEventListener('click',exportValveCsv);
$('ppmLast')?.addEventListener('change',()=>{if($('ppmLast').value&&!$('ppmNext').value)$('ppmNext').value=addMonthsIso($('ppmLast').value,frequencyMonths($('ppmFrequency').value))});

client.auth.onAuthStateChange((event,newSession)=>{
  // Do not make Supabase calls from inside the auth callback.
  // Deferring avoids holding the auth lock while startApp loads database data.
  if(newSession&&!session) setTimeout(()=>startApp(newSession),0);
  else if(!newSession&&session) setTimeout(()=>stopApp(),0);
});
client.auth.getSession().then(({data})=>{ if(data.session && !session) startApp(data.session); else if(!data.session) stopApp(); });
})();


let deferredInstallPrompt=null;

function updateInstallUi(){
  const btn=$('installAppButton');
  const help=$('installAppHelp');
  if(!btn||!help)return;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  if(standalone){
    btn.hidden=true;
    help.hidden=true;
    return;
  }
  if(deferredInstallPrompt){
    btn.hidden=false;
    help.hidden=true;
  }else{
    btn.hidden=true;
    help.hidden=false;
  }
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  updateInstallUi();
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  updateInstallUi();
});

$('installAppButton')?.addEventListener('click',async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  try{await deferredInstallPrompt.userChoice}catch(e){}
  deferredInstallPrompt=null;
  updateInstallUi();
});

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      await navigator.serviceWorker.register('/service-worker.js');
    }catch(e){
      console.warn('Service worker registration failed',e);
    }
    updateInstallUi();
  });
}else{
  updateInstallUi();
}


/* v7.0 unified web/PWA update handling */
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/service-worker.js?v=700',{updateViaCache:'none'});
      await reg.update();
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            worker.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
    }catch(e){console.warn('Service worker registration failed',e)}
  });
  let v7Reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(v7Reloading)return;
    v7Reloading=true;
    location.reload();
  });
}



/* v7.3 Maintenance Centre is a dedicated page at /maintenance-dashboard.html. */
