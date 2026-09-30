(()=>{
  if(!/\/photo-inbox(?:\.html)?$/i.test(location.pathname)) return;

  const style=document.createElement('style');
  style.textContent=`
    .reviewImg{cursor:zoom-in;touch-action:manipulation}
    .photoZoomHint{font-size:12px;color:#68736d;text-align:center;margin-top:-4px;margin-bottom:10px}
    .photoZoomOverlay{position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:20000;display:none;align-items:center;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch}
    .photoZoomOverlay.open{display:flex}
    .photoZoomStage{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:auto;touch-action:pan-x pan-y pinch-zoom}
    .photoZoomOverlay img{display:block;max-width:none;max-height:none;width:auto;height:auto;min-width:min(100vw,100%);object-fit:contain;transform-origin:center center}
    .photoZoomClose{position:fixed;top:14px;right:14px;z-index:20002;border:0;border-radius:999px;background:#fff;color:#17372c;font-weight:900;font-size:18px;line-height:1;padding:12px 15px;box-shadow:0 3px 14px #0008}
    .photoZoomTitle{position:fixed;left:14px;top:16px;right:72px;z-index:20001;color:#fff;font-size:12px;font-weight:700;text-shadow:0 1px 3px #000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.className='photoZoomOverlay';
  overlay.innerHTML='<div class="photoZoomTitle">Full-size photo</div><button class="photoZoomClose" type="button" aria-label="Close full-size photo">✕</button><div class="photoZoomStage"><img alt="Full-size review photo"></div>';
  document.body.appendChild(overlay);

  const full=overlay.querySelector('img');
  const title=overlay.querySelector('.photoZoomTitle');
  const close=()=>{overlay.classList.remove('open');full.removeAttribute('src');document.body.style.overflow='';};
  overlay.querySelector('.photoZoomClose').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close();});

  function bind(){
    const img=document.getElementById('reviewImg');
    if(!img||img.dataset.zoomBound==='1') return;
    img.dataset.zoomBound='1';
    img.setAttribute('title','Tap to open full-size');
    const hint=document.createElement('div');
    hint.className='photoZoomHint';
    hint.textContent='Tap photo to open full-size and pinch to zoom';
    img.insertAdjacentElement('afterend',hint);
    img.addEventListener('click',()=>{
      if(!img.src) return;
      full.src=img.src;
      title.textContent=img.alt||'Full-size review photo';
      overlay.classList.add('open');
      document.body.style.overflow='hidden';
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
