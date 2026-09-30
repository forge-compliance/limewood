(()=>{
  if(!/\/photo-inbox(?:\.html)?$/i.test(location.pathname)) return;

  let pendingAssign=false;
  let assistantCountAtRequest=0;
  const wantsAssign=s=>/\bconfirm(?:ed)?\b[\s\S]{0,40}\bassign\b|\bassign(?:\s+it)?\b/i.test(String(s||''));

  const queueAssignmentFromChat=()=>{
    const input=document.getElementById('chatInput');
    if(!input||!wantsAssign(input.value)) return;
    pendingAssign=true;
    assistantCountAtRequest=document.querySelectorAll('#chatLog .chatBubble.assistant').length;
  };

  document.addEventListener('click',e=>{
    const t=e.target instanceof Element?e.target.closest('#chatSend'):null;
    if(t) queueAssignmentFromChat();
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter' && e.target instanceof Element && e.target.id==='chatInput') queueAssignmentFromChat();
  },true);

  const finishPendingAssignment=()=>{
    if(!pendingAssign) return;
    const assistants=document.querySelectorAll('#chatLog .chatBubble.assistant');
    if(assistants.length<=assistantCountAtRequest) return;
    const last=assistants[assistants.length-1];
    const text=String(last?.textContent||'');
    if(/unavailable|response-format problem|could not complete|error/i.test(text)) return;
    const selected=document.getElementById('assetSelect');
    const button=selected?.value?document.getElementById('approveExisting'):document.getElementById('createSuggested');
    if(!button || button.disabled) return;
    pendingAssign=false;
    const status=document.getElementById('assistantStatus');
    if(status) status.textContent='Confirmation received. Completing assignment…';
    setTimeout(()=>button.click(),120);
  };

  const bind=()=>{
    const img=document.getElementById('reviewImg');
    if(img&&img.dataset.photoActionsBound!=='1'){
      img.dataset.photoActionsBound='1';
      img.style.cursor='zoom-in';

      const actions=document.createElement('div');
      actions.id='photoReviewActions';
      actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px';
      actions.innerHTML='<button type="button" id="openReviewPhoto" style="flex:1;min-width:130px;border:0;border-radius:10px;padding:11px 12px;background:#17372c;color:#fff;font-weight:800">Open full-size</button><a id="downloadReviewPhoto" href="#" download style="flex:1;min-width:130px;text-align:center;text-decoration:none;border:1px solid #17372c;border-radius:10px;padding:10px 12px;color:#17372c;background:#fff;font-weight:800;box-sizing:border-box">Download photo</a>';
      img.insertAdjacentElement('afterend',actions);

      const openBtn=actions.querySelector('#openReviewPhoto');
      const download=actions.querySelector('#downloadReviewPhoto');
      const currentSrc=()=>img.currentSrc||img.src||'';
      const sync=()=>{
        const src=currentSrc();
        if(src){
          download.href=src;
          const name=(src.split('/').pop()||'limewood-photo.jpg').split('?')[0]||'limewood-photo.jpg';
          download.setAttribute('download',name);
        }
      };
      const openFull=()=>{
        const src=currentSrc();
        if(src) window.open(src,'_blank','noopener,noreferrer');
      };
      img.addEventListener('click',openFull);
      openBtn.addEventListener('click',openFull);
      img.addEventListener('load',sync);
      new MutationObserver(sync).observe(img,{attributes:true,attributeFilter:['src']});
      sync();
    }
    finishPendingAssignment();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();