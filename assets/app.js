(() => {
'use strict';

const cfg = window.LIMEWOOD_CONFIG || {};
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
  addAsset:$('addAssetBtn')
};

let session = null;
let assets = [];
let buildings = [];
let plantRooms = [];
let current = null;
let visibleRows = [];
let editing = false;

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
  return `assets/images/${folder}/${base.photo}`;
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
    const { data, error } = await client.from('buildings').insert({name:buildingName, survey_status:'survey_in_progress'}).select().single();
    if (error) throw error;
    building = data; buildings.push(building);
  }
  const { data, error } = await client.from('plant_rooms').insert({building_id:building.id,name:roomName,survey_status:'survey_in_progress'}).select().single();
  if (error) throw error;
  plantRooms.push(data);
  return data;
}

function localSaved(code) {
  try { return JSON.parse(localStorage.getItem(`lw-${code}`) || '{}'); } catch { return {}; }
}

async function seedExistingAssets() {
  const { count, error } = await client.from('assets').select('*', {count:'exact', head:true});
  if (error) throw error;
  if ((count || 0) > 0 || staticBase.length === 0) return;
  setSync('Importing existing 45 assets…');
  const uniqueRooms = [...new Set(staticBase.map(a => a.room).filter(Boolean))];
  for (const roomName of uniqueRooms) await ensurePlantRoom(roomName);
  const userId = session.user.id;
  const rows = staticBase.map(a => {
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
  const rooms = [...new Set(assets.map(a => a.room))].sort();
  const cats = [...new Set(assets.map(a => a.category))].sort();
  els.room.innerHTML = '<option value="">All plant rooms</option>' + rooms.map(x => `<option>${esc(x)}</option>`).join('');
  els.category.innerHTML = '<option value="">All categories</option>' + cats.map(x => `<option>${esc(x)}</option>`).join('');
  if (rooms.includes(currentRoom)) els.room.value = currentRoom;
  if (cats.includes(currentCategory)) els.category.value = currentCategory;
}

function updateStats() {
  els.totalCount.textContent = assets.length;
  els.roomsCount.textContent = new Set(assets.map(a => a.room)).size;
  els.surveyedCount.textContent = assets.filter(a => ['Surveyed','Verified','Operational'].includes(a.status)).length;
  els.reviewCount.textContent = assets.filter(a => ['Needs review','Limited access'].includes(a.status)).length;
  els.photoCount.textContent = assets.reduce((n,a) => n + a.photos.length, 0);
  const setCount = (id, room) => { const el=$(id); if(el) el.textContent=`${assets.filter(a=>a.room===room).length} assets`; };
  setCount('mainCount','Main House Plant Room'); setCount('staffCount','Staff House Plant Room'); setCount('coachCount','Coach House Plant Room');
}

function filtered() {
  const q = els.search.value.trim().toLowerCase();
  return assets.filter(a => {
    const hay = [a.id,a.name,a.room,a.category,a.system,a.manufacturer,a.model,a.serial,a.notes].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!els.room.value || a.room === els.room.value) && (!els.category.value || a.category === els.category.value) && (!els.completeness.value || (els.completeness.value === 'missing' ? isMissing(a) : !isMissing(a)));
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
  els.authMessage.textContent='Signing in…';
  const {error}=await client.auth.signInWithPassword({email:els.authEmail.value.trim(),password:els.authPassword.value});
  els.authMessage.textContent=error?error.message:'';
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
  try { await seedExistingAssets(); await loadCloud(); showView('dashboard'); }
  catch(error){ console.error(error); setSync(error.message || 'Cloud connection failed',true); alert(`Supabase connection error: ${error.message}`); }
}

function stopApp() { session=null; assets=[]; els.appShell.hidden=true; els.authScreen.hidden=false; els.authPassword.value=''; els.authMessage.textContent=''; }

els.signIn.onclick=signIn; els.signUp.onclick=signUp; els.signOut.onclick=()=>client.auth.signOut(); els.refresh.onclick=()=>loadCloud().catch(e=>{setSync(e.message,true);alert(e.message)});
els.grid.addEventListener('click',e=>{const t=e.target.closest('[data-id]');if(t)openAsset(t.dataset.id)});
els.grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.card')){e.preventDefault();openAsset(e.target.dataset.id)}});
els.edit.onclick=()=>setEditing(!editing); els.save.onclick=saveCurrent; els.addAsset.onclick=newAsset; els.close.onclick=closeAsset; els.back.onclick=closeAsset; els.modal.onclick=e=>{if(e.target===els.modal)closeAsset()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAsset()});
[els.search,els.room,els.category,els.completeness].forEach(x=>x.addEventListener('input',render));
function adjacent(n){const i=visibleRows.findIndex(a=>a.id===current?.id),a=visibleRows[i+n];if(a)openAsset(a.id)} els.previous.onclick=()=>adjacent(-1); els.next.onclick=()=>adjacent(1);

const dashboardView=$('dashboardView'),registerView=$('registerView'),placeholderView=$('placeholderView'),registerTitle=$('registerTitle'),drawer=$('drawer'),backdrop=$('drawerBackdrop');
function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}
function showView(n){dashboardView.hidden=n!=='dashboard';registerView.hidden=n!=='register';placeholderView.hidden=n!=='placeholder'}
function showRegister(room=''){showView('register');els.room.value=room;registerTitle.textContent=room?room.replace(' Plant Room',' Asset Register'):'Estate Asset Register';render();closeDrawer()}
function placeholder(t){$('placeholderTitle').textContent=t;showView('placeholder');closeDrawer()}
$('menuBtn').onclick=()=>{drawer.classList.add('open');backdrop.classList.add('open')}; $('closeDrawer').onclick=closeDrawer; backdrop.onclick=closeDrawer;
$('drawerNav').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view==='dashboard'){showView('dashboard');closeDrawer()}else if(b.dataset.view==='search'){showRegister('');setTimeout(()=>els.search.focus(),200)}else if('room'in b.dataset)showRegister(b.dataset.room||'');else if(b.dataset.placeholder)placeholder(b.dataset.placeholder)};
document.querySelectorAll('[data-estate-room]').forEach(b=>b.onclick=()=>showRegister(b.dataset.estateRoom)); document.querySelectorAll('.estateGrid [data-placeholder]').forEach(b=>b.onclick=()=>placeholder(b.dataset.placeholder)); $('backDashboard').onclick=()=>showView('dashboard');

client.auth.onAuthStateChange((event,newSession)=>{ if(newSession&&!session) startApp(newSession); else if(!newSession&&session) stopApp(); });
client.auth.getSession().then(({data})=>{ if(data.session && !session) startApp(data.session); else if(!data.session) stopApp(); });
})();
