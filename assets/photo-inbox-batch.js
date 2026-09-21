/* Keep repeated camera captures in one pending Photo Inbox batch, support ZIP imports, and stop duplicate asset creation. */
(() => {
  'use strict';

  function install() {
    if (!/\/photo-inbox\.html$/i.test(location.pathname)) return;
    const input = document.getElementById('photoFiles');
    if (!input || input.dataset.batchInstalled === '1') return;
    input.dataset.batchInstalled = '1';

    const pending = [];
    const seen = new Set();
    let currentReviewId = null;
    let bypassDuplicateCheck = false;
    let zipBusy = false;

    input.multiple = true;
    input.removeAttribute('capture');
    input.accept = 'image/*,.zip,application/zip,application/x-zip-compressed';

    const cfg = window.LIMEWOOD_CONFIG || {};
    const client = window.supabase?.createClient?.(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:10px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap';
    const count = document.createElement('strong'); count.style.cssText = 'font-size:13px;color:#17372c';
    const addMore = document.createElement('button'); addMore.type='button'; addMore.textContent='Take / add another photo'; addMore.style.cssText='border:1px solid #17372c;background:#17372c;color:#fff;padding:8px 11px;border-radius:9px;font-weight:800';
    const clear = document.createElement('button'); clear.type='button'; clear.textContent='Clear photos'; clear.style.cssText='display:none;border:1px solid #b9c7bf;background:#fff;color:#17372c;padding:7px 10px;border-radius:9px;font-weight:700';
    const zipNote = document.createElement('div'); zipNote.style.cssText='flex-basis:100%;font-size:11px;color:#6b746f;text-align:center'; zipNote.textContent='Photos or ZIP files supported. ZIP limit 50 MB; images inside are unpacked before upload.';
    wrap.append(count,addMore,clear,zipNote); input.insertAdjacentElement('afterend',wrap);

    const key=file=>[file.name,file.size,file.lastModified].join('|');
    function addPending(file){const k=key(file);if(!seen.has(k)){seen.add(k);pending.push(file);}}
    function sync(){const dt=new DataTransfer();pending.forEach(file=>dt.items.add(file));input.files=dt.files;count.textContent=zipBusy?'Unpacking ZIP…':pending.length?`${pending.length} photo${pending.length===1?'':'s'} ready.`:'No photos selected yet.';clear.style.display=pending.length?'inline-block':'none';}
    function imageMime(name){const ext=String(name).split('.').pop().toLowerCase();return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif'})[ext]||'';}
    function isZip(file){return /\.zip$/i.test(file.name)||/^(application\/zip|application\/x-zip-compressed)$/i.test(file.type||'');}
    function isImageName(name){return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);}
    function safeZipName(name){return String(name||'photo').replace(/^\/+|\/+$/g,'').replace(/[\\/]+/g,'__').replace(/[^a-zA-Z0-9._-]+/g,'_');}
    async function ensureJSZip(){
      if(window.JSZip)return window.JSZip;
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load ZIP support. Check the network and try again.'));document.head.appendChild(s);});
      if(!window.JSZip)throw new Error('ZIP support did not initialise.');
      return window.JSZip;
    }
    async function unpackZip(file){
      if(file.size>50*1024*1024)throw new Error(`${file.name} is over the 50 MB ZIP limit.`);
      const JSZip=await ensureJSZip();
      const zip=await JSZip.loadAsync(file);
      const entries=Object.values(zip.files).filter(e=>!e.dir&&isImageName(e.name));
      if(!entries.length)throw new Error(`${file.name} contains no supported images.`);
      if(entries.length>250)throw new Error(`${file.name} contains ${entries.length} images. The ZIP limit is 250 images per batch.`);
      for(const entry of entries){
        const blob=await entry.async('blob');
        const name=safeZipName(entry.name);
        const f=new File([blob],name,{type:imageMime(entry.name)||blob.type||'application/octet-stream',lastModified:file.lastModified||Date.now()});
        addPending(f);
      }
      return entries.length;
    }

    input.addEventListener('change',async()=>{
      const chosen=Array.from(input.files||[]);
      if(!chosen.length)return;
      zipBusy=true;sync();
      let zipImages=0;
      try{
        for(const file of chosen){
          if(isZip(file))zipImages+=await unpackZip(file);
          else if((file.type||'').startsWith('image/')||isImageName(file.name))addPending(file);
        }
        if(zipImages){const status=document.getElementById('uploadStatus');if(status){status.className='status success';status.textContent=`Unpacked ${zipImages} photo${zipImages===1?'':'s'} from ZIP. Ready to upload.`;}}
      }catch(err){const status=document.getElementById('uploadStatus');if(status){status.className='status error';status.textContent=err?.message||String(err);}}
      finally{zipBusy=false;sync();}
    });
    addMore.addEventListener('click',()=>{if(!zipBusy)input.click();});
    clear.addEventListener('click',()=>{pending.length=0;seen.clear();input.value='';sync();});
    document.getElementById('uploadBtn')?.addEventListener('click',event=>{if(zipBusy){event.preventDefault();event.stopImmediatePropagation();const status=document.getElementById('uploadStatus');if(status){status.className='status';status.textContent='Still unpacking the ZIP. Upload will be ready in a moment.';}return;}setTimeout(()=>{if(!input.files.length){pending.length=0;seen.clear();sync();}},250);},true);

    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    function reviewReason(row){
      const ai=row?.ai_result||{};
      const reasons=[];
      const c=Number(ai.confidence);
      if(Number.isFinite(c)&&c<0.98) reasons.push(`AI confidence is ${Math.round(c*100)}%, below the 98% automatic filing threshold.`);
      if(!ai.suggested_location_name&&!row?.location_hint) reasons.push('The exact location could not be confirmed.');
      if(!ai.manufacturer) reasons.push('Manufacturer could not be confirmed.');
      if(!ai.model) reasons.push('Model could not be confirmed.');
      if(!ai.serial_number) reasons.push('Serial number could not be confirmed.');
      if(!ai.suggested_asset_name) reasons.push('AI could not confidently name the asset.');
      if(ai.review_reason) reasons.unshift(String(ai.review_reason));
      if(Array.isArray(ai.review_reasons)) reasons.unshift(...ai.review_reasons.map(String));
      if(!reasons.length) reasons.push('AI identified the equipment, but it was not confident enough to file it automatically. This can happen when it cannot safely prove whether the item is a new asset or an existing one.');
      return [...new Set(reasons)].slice(0,4);
    }
    function showReviewReason(id){
      const row=(window.__lwReviewRows||[]).find(r=>String(r.id)===String(id));
      const meta=document.getElementById('reviewMeta');
      if(!row||!meta) return;
      meta.querySelector('.lwReviewWhy')?.remove();
      const box=document.createElement('div');
      box.className='lwReviewWhy';
      box.style.cssText='margin-top:12px;padding:11px 12px;border-radius:10px;background:#fff4dc;border:1px solid #ead39b;color:#59481d;line-height:1.45';
      box.innerHTML=`<b>Why AI sent this to Human Review</b><br>${reviewReason(row).map(x=>`• ${esc(x)}`).join('<br>')}`;
      meta.appendChild(box);
    }
    document.addEventListener('click',event=>{
      const review=event.target.closest?.('[data-review]');
      if(review?.dataset?.review){currentReviewId=review.dataset.review;setTimeout(()=>showReviewReason(currentReviewId),0);}
    },true);

    if(client){
      const originalInvoke=client.functions.invoke.bind(client.functions);
      client.functions.invoke=async(name,opts)=>{
        const result=await originalInvoke(name,opts);
        if(name==='photo-ai-file'&&opts?.body?.action==='review_list'&&Array.isArray(result?.data?.rows)) window.__lwReviewRows=result.data.rows;
        return result;
      };
    }

    const suggest=document.getElementById('createSuggested'); const status=document.getElementById('reviewStatus'); const actions=document.querySelector('#reviewModal .reviewActions');
    if(actions&&!document.getElementById('deleteReviewPhoto')){
      const del=document.createElement('button');del.id='deleteReviewPhoto';del.type='button';del.textContent='Delete photo';del.style.cssText='border:0;background:#9f2f2f;color:#fff;padding:12px 14px;border-radius:10px;font-weight:800;margin-top:4px';actions.appendChild(del);
      del.addEventListener('click',async()=>{if(!currentReviewId||!client)return;if(!confirm('Delete this photo from Human Review? This removes the inbox record and the stored photo.'))return;del.disabled=true;if(status){status.className='reviewStatus';status.textContent='Deleting photo…';}try{const{data:row,error:loadError}=await client.from('photo_inbox').select('id,storage_path,original_filename').eq('id',currentReviewId).single();if(loadError)throw loadError;if(row?.storage_path){const sr=await client.storage.from(cfg.storageBucket||'asset-files').remove([row.storage_path]);if(sr.error)throw sr.error;}const{error:de}=await client.from('photo_inbox').delete().eq('id',currentReviewId);if(de)throw de;if(status){status.className='reviewStatus success';status.textContent='Photo deleted.';}document.getElementById('reviewModal')?.classList.remove('open');currentReviewId=null;setTimeout(()=>location.reload(),350);}catch(err){if(status){status.className='reviewStatus error';status.textContent='Could not delete photo. '+(err?.message||String(err));}del.disabled=false;}});
    }

    suggest?.addEventListener('click',async event=>{
      if(bypassDuplicateCheck){bypassDuplicateCheck=false;return;} if(!currentReviewId||!client)return;
      event.preventDefault();event.stopImmediatePropagation();suggest.disabled=true;if(status){status.className='reviewStatus';status.textContent='Checking for an existing asset first…';}
      try{const{data,error}=await client.functions.invoke('photo-duplicate-check',{body:{action:'check',id:currentReviewId}});if(error)throw error;if(data?.error)throw new Error(data.error);const match=data?.matches?.[0];if(match){const reason=Array.isArray(match.reasons)&&match.reasons.length?`\nMatch: ${match.reasons.join(', ')}`:'';const useExisting=confirm(`Possible existing asset found:\n\n${match.asset_code} · ${match.asset_name}${match.room_name?`\n${match.room_name}`:''}${reason}\n\nUse this existing asset instead of creating another one?`);if(useExisting){if(status)status.textContent=`Assigning to ${match.asset_code}…`;let assigned;if(match.source==='electrical'){const result=await client.functions.invoke('photo-ai-file',{body:{action:'approve',id:currentReviewId,electrical_asset_id:match.id}});if(result.error)throw result.error;if(result.data?.error)throw new Error(result.data.error);assigned={asset_code:result.data?.asset_code||match.asset_code,asset_name:match.asset_name};}else{const result=await client.functions.invoke('photo-ai-file',{body:{action:'approve',id:currentReviewId,asset_id:match.id}});if(result.error)throw result.error;if(result.data?.error)throw new Error(result.data.error);assigned=result.data?.asset;}if(status){status.className='reviewStatus success';status.textContent=`Assigned to existing ${assigned?.asset_code||match.asset_code} · ${assigned?.asset_name||match.asset_name}`;}setTimeout(()=>location.reload(),700);return;}}
        bypassDuplicateCheck=true;suggest.disabled=false;suggest.click();
      }catch(err){if(status){status.className='reviewStatus error';status.textContent='Duplicate check failed, so no new asset was created. '+(err?.message||String(err));}}finally{suggest.disabled=false;}
    },true);
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();