/* Rich PPM detail view. Uses the existing PPM editor, but adds an engineering-friendly summary first. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let client;
let enhanceTimer=null;
let lastEnhancedCode='';

function ensureClient(){
  if(client)return client;
  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
  client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}

function installStyles(){
  if(document.getElementById('ppmRichDetailStyles'))return;
  const s=document.createElement('style');
  s.id='ppmRichDetailStyles';
  s.textContent=`
  #ppmModal .modalCard{max-width:760px!important;padding:20px!important}
  #ppmModal .ppmRichDetail{display:grid;gap:12px;margin:8px 0 16px}
  #ppmModal .ppmIdentity{background:linear-gradient(135deg,#17372c,#214d3f);border:1px solid #315f50;border-radius:16px;padding:15px;color:#fff}
  #ppmModal .ppmIdentityCode{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c5dacf;font-weight:800}
  #ppmModal .ppmIdentity h3{margin:5px 0 12px;font-size:24px;line-height:1.1;color:#fff}
  #ppmModal .ppmSpecGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  #ppmModal .ppmSpecGrid div{background:#ffffff12;border:1px solid #ffffff18;border-radius:10px;padding:9px}
  #ppmModal .ppmSpecGrid small,#ppmModal .ppmInfoCard small{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;font-weight:800;opacity:.72;margin-bottom:3px}
  #ppmModal .ppmSpecGrid b{font-size:12px;line-height:1.25;word-break:break-word}
  #ppmModal .ppmRichLinks{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  #ppmModal .ppmRichLinks a{display:inline-flex;align-items:center;min-height:34px;padding:7px 10px;border-radius:9px;background:#fff;color:#17372c;text-decoration:none;font-size:11px;font-weight:800}
  #ppmModal .ppmInfoGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #ppmModal .ppmInfoCard{background:#2a2d2b;border:1px solid #46504b;border-radius:13px;padding:12px;color:#e8eeea}
  #ppmModal .ppmInfoCard h4{margin:0 0 7px;font-size:14px;color:#d5eee2}
  #ppmModal .ppmInfoCard p{margin:0;font-size:12px;line-height:1.45;color:#c2cbc6}
  #ppmModal .ppmContractorRow{display:flex;align-items:center;justify-content:space-between;gap:8px}
  #ppmModal .ppmContractorRow a{font-size:11px;color:#cfe9dd;font-weight:800}

  #ppmModal .ppmEditorLabel{margin:3px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:#8f9d96}
  #ppmModal .opsForm{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:0!important}
  #ppmModal .opsForm label{font-size:10px!important;line-height:1.1!important;color:#aebcb5!important;font-weight:800!important;margin:0!important;min-width:0!important}
  #ppmModal .opsForm label:has(#ppmAsset),#ppmModal .opsForm label:has(#ppmFrequency){display:none!important}
  #ppmModal .opsForm label:has(#ppmTask),#ppmModal .opsForm label:has(#ppmNotes){grid-column:1/-1!important}
  #ppmModal .opsForm input,#ppmModal .opsForm select,#ppmModal .opsForm textarea{width:100%!important;min-width:0!important;min-height:38px!important;padding:8px 10px!important;margin-top:5px!important;border-radius:10px!important;font-size:12px!important;line-height:1.25!important}
  #ppmModal .opsForm textarea{min-height:74px!important;resize:vertical!important}
  #ppmModal .modalActions{margin-top:10px!important}
  #ppmModal #savePpm{min-height:42px!important;padding:9px 14px!important}

  @media(max-width:700px){
    #ppmModal .modalCard{padding:14px 12px!important}
    #ppmModal .ppmIdentity h3{font-size:20px}
    #ppmModal .ppmSpecGrid{grid-template-columns:1fr 1fr}
    #ppmModal .ppmSpecGrid div:last-child{grid-column:1/-1}
    #ppmModal .ppmInfoGrid{grid-template-columns:1fr}
    #ppmModal .ppmRichDetail{gap:9px;margin-bottom:11px}
    #ppmModal .ppmEditorLabel{margin-top:0;margin-bottom:7px}
    #ppmModal .opsForm{grid-template-columns:1fr 1fr!important;gap:8px!important}
    #ppmModal .opsForm label:has(#ppmAssigned){grid-column:1/-1!important}
    #ppmModal .opsForm input,#ppmModal .opsForm select{min-height:36px!important;padding:7px 9px!important;font-size:11px!important}
    #ppmModal .opsForm textarea{min-height:66px!important;font-size:11px!important}
  }
  @media(max-width:390px){
    #ppmModal .opsForm{grid-template-columns:1fr 1fr!important}
    #ppmModal .opsForm label{font-size:9px!important}
    #ppmModal .opsForm input,#ppmModal .opsForm select{font-size:10px!important;padding:7px 8px!important}
  }`;
  document.head.appendChild(s);
}

async function enhance(){
  const modal=$('ppmModal');
  if(!modal||modal.getAttribute('aria-hidden')==='true')return false;
  const code=$('ppmAsset')?.value?.trim();
  if(!code)return false;
  const db=ensureClient();
  if(!db)return false;
  const [{data:asset},{data:ppm}]=await Promise.all([
    db.from('assets').select('asset_code,asset_name,manufacturer,model,serial_number,manufacturer_url,manual_url,ppm_frequency,last_service_date,next_service_date').eq('asset_code',code).maybeSingle(),
    db.from('ppm_schedules').select('asset_code,frequency,last_completed,next_due,assigned_to,task,notes,completion_status').eq('asset_code',code).maybeSingle()
  ]);
  if(!asset)return false;
  installStyles();
  let rich=$('ppmRichDetail');
  if(!rich){
    rich=document.createElement('section');
    rich.id='ppmRichDetail';
    rich.className='ppmRichDetail';
    const form=modal.querySelector('.opsForm');
    form?.parentNode?.insertBefore(rich,form);
    if(form){const lab=document.createElement('div');lab.className='ppmEditorLabel';lab.textContent='Service record';form.parentNode.insertBefore(lab,form);}
  }
  const contractor=ppm?.assigned_to||'Not linked yet';
  const task=ppm?.task||'Maintenance scope not yet confirmed.';
  const docs=[asset.manufacturer_url?`<a href="${esc(asset.manufacturer_url)}" target="_blank" rel="noopener">Manufacturer page ↗</a>`:'',asset.manual_url?`<a href="${esc(asset.manual_url)}" target="_blank" rel="noopener">Service manual ↗</a>`:''].join('');
  rich.innerHTML=`
    <section class="ppmIdentity">
      <span class="ppmIdentityCode">${esc(asset.asset_code)}</span>
      <h3>${esc(asset.asset_name||asset.asset_code)}</h3>
      <div class="ppmSpecGrid">
        <div><small>Make</small><b>${esc(asset.manufacturer||'Unknown')}</b></div>
        <div><small>Model</small><b>${esc(asset.model||'Unknown')}</b></div>
        <div><small>Serial</small><b>${esc(asset.serial_number||'Not recorded')}</b></div>
      </div>
      ${docs?`<div class="ppmRichLinks">${docs}</div>`:''}
    </section>
    <section class="ppmInfoGrid">
      <article class="ppmInfoCard"><small>Service schedule</small><h4>${esc(ppm?.frequency||asset.ppm_frequency||'Not set')}</h4><p>Last completed: ${esc(ppm?.last_completed||asset.last_service_date||'Not recorded')}<br>Next due: ${esc(ppm?.next_due||asset.next_service_date||'Date required')}</p></article>
      <article class="ppmInfoCard"><small>Contractor</small><div class="ppmContractorRow"><h4>${esc(contractor)}</h4><a href="/contractor-dashboard.html">Contractors & Quotes →</a></div><p>Link the regular service contractor here once their record is added.</p></article>
      <article class="ppmInfoCard" style="grid-column:1/-1"><small>Manufacturer-backed service scope</small><h4>${esc(asset.manufacturer||'Manufacturer')} recommendations</h4><p>${esc(task)}</p></article>
    </section>`;
  const title=$('ppmModalTitle');if(title)title.textContent=`${asset.asset_code} · ${asset.asset_name}`;
  lastEnhancedCode=code;
  return true;
}

function scheduleEnhance(){
  clearTimeout(enhanceTimer);
  let attempts=0;
  const tryEnhance=()=>{
    const modal=$('ppmModal');
    if(!modal||modal.getAttribute('aria-hidden')==='true')return;
    const code=$('ppmAsset')?.value?.trim();
    if(code&&code!==lastEnhancedCode){
      enhance().catch(console.warn);
      return;
    }
    if(code&&lastEnhancedCode===code){
      enhance().catch(console.warn);
      return;
    }
    attempts++;
    if(attempts<30)enhanceTimer=setTimeout(tryEnhance,100);
  };
  tryEnhance();
}

function init(){
  const modal=$('ppmModal');
  if(!modal)return setTimeout(init,300);
  const assetInput=$('ppmAsset');
  const obs=new MutationObserver(()=>{if(modal.getAttribute('aria-hidden')!=='true')scheduleEnhance();});
  obs.observe(modal,{attributes:true,attributeFilter:['aria-hidden','class','style']});
  if(assetInput){
    const valueObserver=new MutationObserver(scheduleEnhance);
    valueObserver.observe(assetInput,{attributes:true,attributeFilter:['value']});
    assetInput.addEventListener('input',scheduleEnhance);
    assetInput.addEventListener('change',scheduleEnhance);
  }
  modal.addEventListener('click',scheduleEnhance);
  document.addEventListener('click',e=>{if(e.target.closest('[data-ppm]'))setTimeout(scheduleEnhance,0);},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
