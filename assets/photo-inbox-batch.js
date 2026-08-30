/* Keep repeated camera captures in one pending Photo Inbox batch and stop duplicate asset creation. */
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

    input.multiple = true;
    input.removeAttribute('capture');

    const cfg = window.LIMEWOOD_CONFIG || {};
    const client = window.supabase?.createClient?.(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:10px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap';
    const count = document.createElement('strong'); count.style.cssText = 'font-size:13px;color:#17372c';
    const addMore = document.createElement('button'); addMore.type='button'; addMore.textContent='Take / add another photo'; addMore.style.cssText='border:1px solid #17372c;background:#17372c;color:#fff;padding:8px 11px;border-radius:9px;font-weight:800';
    const clear = document.createElement('button'); clear.type='button'; clear.textContent='Clear photos'; clear.style.cssText='display:none;border:1px solid #b9c7bf;background:#fff;color:#17372c;padding:7px 10px;border-radius:9px;font-weight:700';
    wrap.append(count,addMore,clear); input.insertAdjacentElement('afterend',wrap);
    const key=file=>[file.name,file.size,file.lastModified].join('|');
    function sync(){const dt=new DataTransfer();pending.forEach(file=>dt.items.add(file));input.files=dt.files;count.textContent=pending.length?`${pending.length} photo${pending.length===1?'':'s'} ready.`:'No photos selected yet.';clear.style.display=pending.length?'inline-block':'none';}
    input.addEventListener('change',()=>{Array.from(input.files||[]).forEach(file=>{const k=key(file);if(!seen.has(k)){seen.add(k);pending.push(file);}});sync();});
    addMore.addEventListener('click',()=>input.click());
    clear.addEventListener('click',()=>{pending.length=0;seen.clear();input.value='';sync();});
    document.getElementById('uploadBtn')?.addEventListener('click',()=>setTimeout(()=>{if(!input.files.length){pending.length=0;seen.clear();sync();}},250));

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

    /* Capture the review-list response without changing the main page. */
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