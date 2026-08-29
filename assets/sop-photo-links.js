// Limewood SOP ↔ Photo Inbox linking
(() => {
  'use strict';

  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let reviewPhotoId='';

  async function currentUserId(){
    const {data}=await db.auth.getSession();
    return data?.session?.user?.id||null;
  }

  async function fetchSops(){
    const {data,error}=await db.from('sops').select('id,sop_number,title,status').order('sop_number');
    if(error)throw error;
    return data||[];
  }

  async function linkPhotoToSop(photoId,sopId){
    const userId=await currentUserId();
    if(!userId)throw new Error('Sign in again before linking photos.');
    const {error}=await db.from('sop_photos').upsert({sop_id:sopId,photo_inbox_id:photoId,created_by:userId},{onConflict:'sop_id,photo_inbox_id'});
    if(error)throw error;
  }

  function installPhotoInboxLinker(){
    if(!/\/photo-inbox\.html$/i.test(location.pathname))return;
    const actions=$('.reviewActions');
    if(!actions||$('#lwPhotoSopBox'))return;

    const box=document.createElement('div');
    box.id='lwPhotoSopBox';
    box.className='assetPickerBox';
    box.innerHTML=`
      <div class="assetPickerTitle"><b>Link photo to SOP</b><span>Optional</span></div>
      <label>SOP<select id="lwPhotoSopSelect"><option value="">Select an SOP…</option></select></label>
      <button type="button" id="lwPhotoSopLink" class="approveBtn" style="margin-top:10px;width:100%">Link this photo to SOP</button>
      <div id="lwPhotoSopStatus" class="reviewStatus"></div>`;
    const tiny=[...actions.children].find(x=>x.classList?.contains('tiny'));
    actions.insertBefore(box,tiny||actions.lastElementChild);

    const select=$('#lwPhotoSopSelect');
    fetchSops().then(rows=>{
      select.innerHTML='<option value="">Select an SOP…</option>'+rows.map(s=>`<option value="${esc(s.id)}">${esc(s.sop_number)} · ${esc(s.title)}</option>`).join('');
    }).catch(e=>{$('#lwPhotoSopStatus').textContent=e.message;});

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-review]');
      if(b?.dataset?.review){reviewPhotoId=b.dataset.review;$('#lwPhotoSopStatus').textContent='';}
    },true);

    $('#lwPhotoSopLink').addEventListener('click',async()=>{
      const sopId=select.value;
      const status=$('#lwPhotoSopStatus');
      if(!reviewPhotoId){status.textContent='Open a photo first.';return;}
      if(!sopId){status.textContent='Choose an SOP first.';return;}
      try{
        await linkPhotoToSop(reviewPhotoId,sopId);
        status.className='reviewStatus success';
        status.textContent='Photo linked to SOP.';
      }catch(e){status.className='reviewStatus error';status.textContent=e?.message||String(e);}
    });
  }

  function ensureSopPhotoSection(){
    const modal=$('#lwSopBuilder');
    if(!modal||$('#lwSopPhotoSection'))return;
    const grid=$('.lwSopGrid',modal);
    if(!grid)return;
    const wrap=document.createElement('div');
    wrap.id='lwSopPhotoSection';
    wrap.className='wide';
    wrap.style.cssText='border:1px solid #dfe5e0;border-radius:12px;padding:12px;background:#f8faf8';
    wrap.innerHTML=`
      <label style="display:block">Linked photos</label>
      <div id="lwSopPhotoCurrent" style="display:grid;gap:8px;margin:8px 0"></div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
        <label style="margin:0">Add an uploaded photo<select id="lwSopPhotoSelect"><option value="">Select a Photo Inbox image…</option></select></label>
        <button type="button" id="lwSopPhotoAdd" style="border:0;border-radius:10px;background:#17372c;color:#fff;padding:11px 14px;font-weight:800">Link photo</button>
      </div>
      <div id="lwSopPhotoMessage" class="lwSopMessage"></div>`;
    grid.appendChild(wrap);
    $('#lwSopPhotoAdd').onclick=addPhotoFromSop;
  }

  async function sopFromBuilder(){
    const number=$('#lwSopNumber')?.value?.trim();
    if(!number)return null;
    const {data,error}=await db.from('sops').select('id,sop_number,title').eq('sop_number',number).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function loadPhotoChoices(sop){
    const select=$('#lwSopPhotoSelect');
    const current=$('#lwSopPhotoCurrent');
    const msg=$('#lwSopPhotoMessage');
    if(!select||!current)return;
    msg.textContent='';
    if(!sop){
      current.innerHTML='<small>Save the SOP first, then you can link photos to it.</small>';
      select.innerHTML='<option value="">Save SOP first…</option>';
      select.disabled=true;
      $('#lwSopPhotoAdd').disabled=true;
      return;
    }
    select.disabled=false;$('#lwSopPhotoAdd').disabled=false;
    const [{data:photos,error:pErr},{data:links,error:lErr}]=await Promise.all([
      db.from('photo_inbox').select('id,original_filename,location_hint,storage_path,created_at').order('created_at',{ascending:false}).limit(150),
      db.from('sop_photos').select('id,photo_inbox_id,caption,sort_order').eq('sop_id',sop.id).order('sort_order')
    ]);
    if(pErr)throw pErr;if(lErr)throw lErr;
    const rows=photos||[];const linked=links||[];const linkedIds=new Set(linked.map(x=>String(x.photo_inbox_id)));
    select.innerHTML='<option value="">Select a Photo Inbox image…</option>'+rows.filter(p=>!linkedIds.has(String(p.id))).map(p=>`<option value="${esc(p.id)}">${esc(p.original_filename||'Photo')} · ${esc(p.location_hint||'No location')}</option>`).join('');
    current.innerHTML=linked.length?linked.map(link=>{
      const p=rows.find(x=>String(x.id)===String(link.photo_inbox_id));
      return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e1e5e1;padding:9px;border-radius:9px"><span><b>${esc(p?.original_filename||'Linked photo')}</b><br><small>${esc(p?.location_hint||'')}</small></span><button type="button" data-lw-sop-photo-unlink="${esc(link.id)}" style="border:0;background:#eee;border-radius:8px;padding:7px 9px;font-weight:700">Remove</button></div>`;
    }).join(''):'<small>No photos linked yet.</small>';
    current.querySelectorAll('[data-lw-sop-photo-unlink]').forEach(b=>b.onclick=async()=>{
      const {error}=await db.from('sop_photos').delete().eq('id',b.dataset.lwSopPhotoUnlink);if(error){msg.textContent=error.message;return;}await loadPhotoChoices(sop);
    });
  }

  async function addPhotoFromSop(){
    const msg=$('#lwSopPhotoMessage');
    try{
      const sop=await sopFromBuilder();
      if(!sop){msg.textContent='Save the SOP first.';return;}
      const photoId=$('#lwSopPhotoSelect')?.value;
      if(!photoId){msg.textContent='Choose a photo first.';return;}
      await linkPhotoToSop(photoId,sop.id);
      msg.textContent='Photo linked.';
      await loadPhotoChoices(sop);
    }catch(e){msg.textContent=e?.message||String(e);}
  }

  function watchSopBuilder(){
    ensureSopPhotoSection();
    const modal=$('#lwSopBuilder');
    if(!modal)return;
    const obs=new MutationObserver(async()=>{
      if(!modal.classList.contains('open'))return;
      ensureSopPhotoSection();
      try{await loadPhotoChoices(await sopFromBuilder());}catch(e){const m=$('#lwSopPhotoMessage');if(m)m.textContent=e.message;}
    });
    obs.observe(modal,{attributes:true,attributeFilter:['class']});
    $('#lwSopNumber')?.addEventListener('change',async()=>{if(modal.classList.contains('open'))await loadPhotoChoices(await sopFromBuilder());});
  }

  function run(){installPhotoInboxLinker();watchSopBuilder();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250));
  else setTimeout(run,250);
  window.addEventListener('load',()=>setTimeout(run,900));
})();
