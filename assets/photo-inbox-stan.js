(()=>{
  const cfg=window.LIMEWOOD_CONFIG||{};

  // Stan smart-review bridge. Supabase Functions uses window.fetch, so enrich only
  // photo-review-assistant requests without changing the rest of the site.
  if(!window.__limewoodStanSmartFetch){
    window.__limewoodStanSmartFetch=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      try{
        const url=typeof input==='string'?input:(input&&input.url)||'';
        if(/\/functions\/v1\/photo-review-assistant(?:\?|$)/.test(url)&&init?.body){
          const body=JSON.parse(String(init.body));
          const original=String(body?.message||'').trim();
          const instruction="STAN SMART REVIEW MODE. Work this asset out yourself before asking Gary for information. Use the photo, nameplate, current draft, location hint, electrical register and circuit register supplied by the review system. For electrical details, search for the strongest likely upstream board or MCP, circuit reference, protective device, device rating, phase, isolation relationship and equipment served. Never ask Gary to investigate information that exists in those registers. If evidence is conclusive, fill the fields. If one match is plausible but not certain, do not save uncertain values yet: state the exact proposed register values and ask Gary only to confirm or correct them. If Gary answers yes, confirmed or correct, apply the proposal from the previous chat message. Only ask an open-ended question when the photo and registers contain no credible candidate. Do the same for location. Never invent electrical data. Do not mark the asset ready while a proposed match is awaiting confirmation.";
          body.message=instruction+(original?"\n\nGary's message: "+original:"\n\nContinue the review now. Resolve everything you can and propose the strongest exact match for anything uncertain.");
          init={...init,body:JSON.stringify(body)};
        }
      }catch(e){console.warn('Stan smart-review bridge skipped',e);}
      return nativeFetch(input,init);
    };
  }

  const client=window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey
    ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})
    : null;

  const style=document.createElement('style');
  style.textContent=`
    .queueItemActions{display:flex;gap:7px;align-items:center;flex:none}
    .reviewPrimaryActions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:stretch}
    .removeReviewBtn,.deleteReviewPhotoBtn{border:1px solid #d7b8b8;background:#fff7f7;color:#8b2f2f;border-radius:9px;font-weight:800;cursor:pointer}
    .removeReviewBtn{padding:9px 10px;font-size:12px}
    .deleteReviewPhotoBtn{padding:11px 14px;white-space:nowrap}
    .reviewPrimaryActions .approveBtn{width:100%}
    .removeReviewBtn:disabled,.deleteReviewPhotoBtn:disabled{opacity:.55;cursor:default}
    .stanCircuitPanel{margin-top:12px;padding:12px;border:1px solid #d8e3dc;background:#fff;border-radius:12px}
    .stanCircuitHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}
    .stanCircuitHead b{color:#17372c;font-size:13px}.stanCircuitHead small{color:#6c7771;font-size:10px}
    .stanCircuitList{display:grid;gap:6px;max-height:260px;overflow:auto}
    .stanCircuitBtn{display:grid;grid-template-columns:72px minmax(0,1fr);gap:9px;text-align:left;width:100%;border:1px solid #dde4df;background:#f8faf8;border-radius:9px;padding:9px 10px;cursor:pointer;color:#1d2823}
    .stanCircuitBtn:hover{border-color:#9fb8aa;background:#eef5f0}.stanCircuitBtn strong{color:#17372c}.stanCircuitBtn span{font-size:12px}.stanCircuitMeta{grid-column:2;font-size:10px;color:#77817c;margin-top:-4px}
    .stanCircuitEmpty{font-size:12px;color:#7b847f;padding:4px 0}
    @media(max-width:600px){.queueItemActions{flex-direction:column;align-items:stretch}.removeReviewBtn{padding:8px 10px}.stanCircuitBtn{grid-template-columns:58px minmax(0,1fr)}.reviewPrimaryActions{grid-template-columns:minmax(0,1fr) auto}.deleteReviewPhotoBtn{padding:10px 12px}}
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
    if(!confirm('Delete this review and uploaded photo? This cannot be undone.'))return;
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Deleting…';}
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
      alert('Could not delete review: '+(e?.message||String(e)));
      if(button){button.disabled=false;button.textContent=old||'Delete';}
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
      remove.textContent='Delete';
      remove.addEventListener('click',e=>{e.stopPropagation();removePhoto(id,remove);});
      wrap.appendChild(remove);
    });
  };

  const enhanceModal=()=>{
    const actions=document.querySelector('.reviewActions');
    const approve=document.getElementById('approveExisting');
    if(!actions||!approve||actions.querySelector('.deleteReviewPhotoBtn'))return;
    const row=document.createElement('div');
    row.className='reviewPrimaryActions';
    approve.parentNode.insertBefore(row,approve);
    row.appendChild(approve);
    const del=document.createElement('button');
    del.type='button';
    del.className='deleteReviewPhotoBtn';
    del.textContent='Delete';
    del.addEventListener('click',()=>{
      const openReview=document.querySelector('#queueList [data-review].reviewBtn[data-review]');
      const meta=document.getElementById('reviewMeta');
      const filename=meta?.querySelector('b')?.textContent?.trim();
      if(!filename||!client)return;
      client.from('photo_inbox').select('id').eq('original_filename',filename).eq('status','unassigned').order('created_at',{ascending:false}).limit(1).maybeSingle().then(({data,error})=>{
        if(error)alert('Could not identify this review photo: '+error.message);
        else if(data?.id)removePhoto(data.id,del);
        else alert('This review record is no longer in the Photo Inbox.');
      });
    });
    row.appendChild(del);
  };

  let lastCircuitBoard='';
  const boardCodeFromReview=()=>{
    const draft=document.getElementById('draftFields')?.innerText||'';
    const chat=[...document.querySelectorAll('#chatLog .chatBubble')].map(x=>x.innerText||'').join('\n');
    const meta=document.getElementById('reviewMeta')?.innerText||'';
    const text=[draft,chat,meta].join('\n');
    const patterns=[
      /\b((?:MH|SH|CH|SPA|FCL|GB|PAV\d*|CRE)-DB-[A-Z0-9-]+)\b/i,
      /\b((?:MH|SH|CH|SPA|FCL|GB|PAV\d*|CRE)-(?:MCP|CU)-[A-Z0-9-]+)\b/i,
      /\b((?:MH|SH|CH|SPA|FCL|GB|PAV\d*|CRE)-E-\d{3})\b/i
    ];
    for(const p of patterns){const m=text.match(p);if(m)return m[1].toUpperCase();}
    return '';
  };

  const circuitSort=(a,b)=>String(a.circuit_number||'').localeCompare(String(b.circuit_number||''),undefined,{numeric:true,sensitivity:'base'});

  const renderCircuitPanel=async()=>{
    if(!client)return;
    const box=document.querySelector('.reviewAssistant');
    const composer=box?.querySelector('.chatComposer');
    if(!box||!composer)return;
    const board=boardCodeFromReview();
    let panel=box.querySelector('.stanCircuitPanel');
    if(!board){if(panel)panel.remove();lastCircuitBoard='';return;}
    if(board===lastCircuitBoard&&panel)return;
    lastCircuitBoard=board;
    if(!panel){panel=document.createElement('div');panel.className='stanCircuitPanel';composer.parentNode.insertBefore(panel,composer);}
    panel.innerHTML=`<div class="stanCircuitHead"><div><b>${board} circuit schedule</b><br><small>Loading live register…</small></div></div>`;
    try{
      const {data,error}=await client.from('electrical_circuits').select('circuit_number,circuit_description,destination,phase,protective_device,device_rating,verification_status').eq('board_asset_code',board);
      if(error)throw error;
      const rows=(data||[]).sort(circuitSort);
      if(!rows.length){panel.innerHTML=`<div class="stanCircuitHead"><div><b>${board} circuit schedule</b><br><small>Live electrical register</small></div></div><div class="stanCircuitEmpty">No outgoing circuits are recorded for this board yet.</div>`;return;}
      panel.innerHTML=`<div class="stanCircuitHead"><div><b>${board} circuit schedule</b><br><small>${rows.length} live circuit${rows.length===1?'':'s'} · click one to confirm it to Stan</small></div></div><div class="stanCircuitList">${rows.map((r,i)=>`<button type="button" class="stanCircuitBtn" data-stan-circuit="${i}"><strong>${String(r.circuit_number||'?').replace(/[&<>"']/g,'')}</strong><span>${String(r.circuit_description||r.destination||'Unnamed circuit').replace(/[&<>]/g,'')}</span><div class="stanCircuitMeta">${[r.phase,r.protective_device,r.device_rating,r.verification_status].filter(Boolean).join(' · ')}</div></button>`).join('')}</div>`;
      panel.querySelectorAll('[data-stan-circuit]').forEach(btn=>btn.addEventListener('click',()=>{
        const r=rows[Number(btn.dataset.stanCircuit)];
        if(!r)return;
        const input=document.getElementById('chatInput'),send=document.getElementById('chatSend');
        if(!input||!send)return;
        const description=r.circuit_description||r.destination||'Unnamed circuit';
        input.value=`Confirmed: ${board} circuit ${r.circuit_number} - ${description}. Use this circuit for the asset electrical supply.`;
        send.click();
      }));
    }catch(e){panel.innerHTML=`<div class="stanCircuitHead"><div><b>${board} circuit schedule</b></div></div><div class="stanCircuitEmpty">Could not load the live circuit register: ${String(e?.message||e)}</div>`;}
  };

  const apply=()=>{applyIdentity();enhanceQueue();enhanceModal();renderCircuitPanel();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();