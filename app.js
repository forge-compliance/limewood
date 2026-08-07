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
  renderDocuments();
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
  try {
    // Load existing buildings and plant rooms before attempting the one-time asset import.
    // This prevents duplicate building and room inserts on a fresh deployment.
    await loadCloud();
    await seedExistingAssets();
    await loadCloud();
    await loadDocumentCentre();
    showView('dashboard');
  }
  catch(error){ console.error(error); setSync(error.message || 'Cloud connection failed',true); alert(`Supabase connection error: ${error.message}`); }
}

function stopApp() { session=null; assets=[]; els.appShell.hidden=true; els.authScreen.hidden=false; els.authPassword.value=''; els.authMessage.textContent=''; }

els.signIn.onclick=signIn; els.signUp.onclick=signUp; els.signOut.onclick=()=>client.auth.signOut(); els.refresh.onclick=()=>Promise.all([loadCloud(),loadDocumentCentre()]).catch(e=>{setSync(e.message,true);alert(e.message)});
els.grid.addEventListener('click',e=>{const t=e.target.closest('[data-id]');if(t)openAsset(t.dataset.id)});
els.grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.card')){e.preventDefault();openAsset(e.target.dataset.id)}});
els.edit.onclick=()=>setEditing(!editing); els.save.onclick=saveCurrent; els.addAsset.onclick=newAsset; els.close.onclick=closeAsset; els.back.onclick=closeAsset; els.modal.onclick=e=>{if(e.target===els.modal)closeAsset()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAsset()});
[els.search,els.room,els.category,els.completeness].forEach(x=>x.addEventListener('input',render));
function adjacent(n){const i=visibleRows.findIndex(a=>a.id===current?.id),a=visibleRows[i+n];if(a)openAsset(a.id)} els.previous.onclick=()=>adjacent(-1); els.next.onclick=()=>adjacent(1);

const dashboardView=$('dashboardView'),registerView=$('registerView'),documentView=$('documentView'),placeholderView=$('placeholderView'),registerTitle=$('registerTitle'),drawer=$('drawer'),backdrop=$('drawerBackdrop');
function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true')}
function showView(n){dashboardView.hidden=n!=='dashboard';registerView.hidden=n!=='register';documentView.hidden=n!=='documents';placeholderView.hidden=n!=='placeholder'}
function showRegister(room=''){showView('register');els.room.value=room;registerTitle.textContent=room?room.replace(' Plant Room',' Asset Register'):'Estate Asset Register';render();closeDrawer()}
function placeholder(t){$('placeholderTitle').textContent=t;showView('placeholder');closeDrawer()}
$('menuBtn').onclick=()=>{drawer.scrollTop=0;drawer.classList.add('open');backdrop.classList.add('open');drawer.setAttribute('aria-hidden','false')}; $('closeDrawer').onclick=closeDrawer; backdrop.onclick=closeDrawer;
$('drawerNav').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view==='dashboard'){showView('dashboard');closeDrawer()}else if(b.dataset.view==='search'){showRegister('');setTimeout(()=>els.search.focus(),200)}else if(b.dataset.view==='documents'){showDocuments(b.dataset.docType||'')}else if('room'in b.dataset)showRegister(b.dataset.room||'');else if(b.dataset.placeholder)placeholder(b.dataset.placeholder)};
document.querySelectorAll('[data-estate-room]').forEach(b=>b.onclick=()=>showRegister(b.dataset.estateRoom)); document.querySelectorAll('.estateGrid [data-placeholder]').forEach(b=>b.onclick=()=>placeholder(b.dataset.placeholder)); $('backDashboard').onclick=()=>showView('dashboard');


docEls.add.onclick=openDocumentUpload; docEls.close.onclick=closeDocumentUpload; docEls.modal.onclick=e=>{if(e.target===docEls.modal)closeDocumentUpload()}; docEls.save.onclick=saveLibraryDocument;
docEls.building.onchange=updateDocumentPlantRooms;
docEls.type.onchange=()=>{ const isSop=docEls.type.value==='sop'; docEls.number.placeholder=isSop?'e.g. SOP-001':'Optional document number'; if(isSop&&!docEls.revision.value)docEls.revision.value='1'; };
docEls.file.onchange=()=>{ const file=docEls.file.files[0]; docEls.message.classList.remove('success'); docEls.message.textContent=file?`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB selected`:''; };
[docEls.search,docEls.typeFilter,docEls.buildingFilter,docEls.statusFilter].forEach(x=>x.addEventListener('input',renderDocuments));

client.auth.onAuthStateChange((event,newSession)=>{
  // Do not make Supabase calls from inside the auth callback.
  // Deferring avoids holding the auth lock while startApp loads database data.
  if(newSession&&!session) setTimeout(()=>startApp(newSession),0);
  else if(!newSession&&session) setTimeout(()=>stopApp(),0);
});
client.auth.getSession().then(({data})=>{ if(data.session && !session) startApp(data.session); else if(!data.session) stopApp(); });
})();
