(()=>{
  const cfg=window.LIMEWOOD_CONFIG||{};
  const client=window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey
    ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})
    : null;

  const style=document.createElement('style');
  style.textContent=`
    .queueItemActions{display:flex;gap:7px;align-items:center;flex:none}
    .removeReviewBtn,.deleteReviewPhotoBtn{border:1px solid #d7b8b8;background:#fff7f7;color:#8b2f2f;border-radius:9px;font-weight:800;cursor:pointer}
    .removeReviewBtn{padding:9px 10px;font-size:12px}
    .deleteReviewPhotoBtn{width:100%;padding:11px 13px;margin-top:10px}
    .removeReviewBtn:disabled,.deleteReviewPhotoBtn:disabled{opacity:.55;cursor:default}
    @media(max-width:600px){.queueItemActions{flex-direction:column;align-items:stretch}.removeReviewBtn{padding:8px 10px}}
  `;
  document.head.appendChild(style);

  const applyIdentity=()=>{
    const box=document.querySelector('.reviewAssistant');
    const head=box?.querySelector('.assistantHead');
    if(!box||!head)return;
    head.innerHTML=`<div class="stanIdentity"><div class="stanAvatar">S</div><div><div class="stanName">Stan</div><div class="stanPresence"><span></span> Photo review assistant</div></div></div>`;
    const input=box.querySelector('#chatInput');
    if(input) input.placeholder='Message Stan…';
    const send=box.querySelector('#chatSend');
    if(send) send.textContent='Send';
  };

  const refreshCounts=async()=>{
    if(!client)return;
    const [w,r,d]=await Promise.all([
      client.from('photo_inbox').select('*',{count:'exact',head:true}).eq('status','unassigned'),
      client.from('photo_inbox').select('*',{count:'exact',head:true}).eq('status','unassigned').eq('ai_status','processed'),
      client.from('photo_inbox').select('*',{count:'exact',head:true}).eq('status','assigned')
    ]);
    const waiting=document.getElementById('unassignedCount');
    const reviewed=document.getElementById('aiCount');
    const assigned=document.getElementById('assignedCount');
    if(waiting)waiting.textContent=w.count||0;
    if(reviewed)reviewed.textContent=r.count||0;
    if(assigned)assigned.textContent=d.count||0;
  };

  const removePhoto=async(id,button)=>{
    if(!client||!id)return;
    if(!confirm('Remove this photo from review? This deletes the Photo Inbox record and the uploaded photo.'))return;
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Removing…';}
    try{
      const {data:row,error:readError}=await client.from('photo_inbox').select('id,storage_path,original_filename').eq('id',id).single();
      if(readError)throw readError;
      if(row?.storage_path){
        const rm=await client.storage.from(cfg.storageBucket||'asset-files').remove([row.storage_path]);
        if(rm.error)throw rm.error;
      }
      const del=await client.from('photo_inbox').delete().eq('id',id);
      if(del.error)throw del.error;
      document.querySelector(`.queueItem [data-review="${CSS.escape(id)}"]`)?.closest('.queueItem')?.remove();
      const modal=document.getElementById('reviewModal');
      if(modal?.classList.contains('open')){
        modal.classList.remove('open');
        const img=document.getElementById('reviewImg');
        if(img)img.src='';
      }
      await refreshCounts();
      const list=document.getElementById('queueList');
      if(list&&!list.querySelector('.queueItem'))list.innerHTML='<p>No photos are awaiting human review.</p>';
    }catch(e){
      alert('Could not remove photo: '+(e?.message||String(e)));
      if(button){button.disabled=false;button.textContent=old||'Remove';}
    }
  };

  const enhanceQueue=()=>{
    document.querySelectorAll('#queueList .queueItem').forEach(item=>{
      const review=item.querySelector('[data-review]');
      if(!review||item.querySelector('.removeReviewBtn'))return;
      const id=review.dataset.review;
      const wrap=document.createElement('div');
      wrap.className='queueItemActions';
      review.parentNode.insertBefore(wrap,review);
      wrap.appendChild(review);
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='removeReviewBtn';
      remove.textContent='Remove';
      remove.addEventListener('click',e=>{e.stopPropagation();removePhoto(id,remove);});
      wrap.appendChild(remove);
    });
  };

  const enhanceModal=()=>{
    const actions=document.querySelector('.reviewActions');
    if(!actions||actions.querySelector('.deleteReviewPhotoBtn'))return;
    const del=document.createElement('button');
    del.type='button';
    del.className='deleteReviewPhotoBtn';
    del.textContent='Remove this photo from review';
    del.addEventListener('click',()=>{
      const meta=document.getElementById('reviewMeta');
      const filename=meta?.querySelector('b')?.textContent?.trim();
      if(!filename||!client)return;
      client.from('photo_inbox').select('id').eq('original_filename',filename).eq('status','unassigned').order('created_at',{ascending:false}).limit(1).maybeSingle().then(({data,error})=>{
        if(error)alert('Could not identify this review photo: '+error.message);
        else if(data?.id)removePhoto(data.id,del);
      });
    });
    actions.appendChild(del);
  };

  const apply=()=>{applyIdentity();enhanceQueue();enhanceModal();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();