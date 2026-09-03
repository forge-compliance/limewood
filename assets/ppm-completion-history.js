/* Complete PPMs safely and write each completion into the asset maintenance history. */
(()=>{
'use strict';
const cfg=window.LIMEWOOD_CONFIG||{};
let db=null,schedules=[],loadedAt=0,pending=null;
const $=id=>document.getElementById(id);
function client(){
  if(db)return db;
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
  db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return db;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));}
async function loadSchedules(force=false){
  if(!force&&schedules.length&&Date.now()-loadedAt<30000)return schedules;
  const c=client(); if(!c)return [];
  const {data,error}=await c.from('ppm_schedules').select('id,asset_code,frequency,last_completed,next_due,assigned_to,completion_status,task,notes').order('next_due',{ascending:true,nullsFirst:false});
  if(error){console.warn('PPM completion schedule load failed',error);return schedules;}
  schedules=data||[]; loadedAt=Date.now(); return schedules;
}
function text(el,sel){return el.querySelector(sel)?.textContent?.trim()||'';}
function cardSchedule(card){
  const code=card?.dataset?.ppm||'';
  const due=text(card,'.ppmDue');
  const task=text(card,'p');
  const meta=[...card.querySelectorAll('.ppmMeta span')].map(x=>x.textContent.trim());
  const frequency=(meta.find(x=>/^Frequency/i.test(x))||'').replace(/^Frequency/i,'').trim();
  const candidates=schedules.filter(s=>s.asset_code===code);
  if(candidates.length===1)return candidates[0];
  return candidates.find(s=>String(s.next_due||'No due date')===due&&String(s.frequency||'To confirm')===frequency)
    || candidates.find(s=>String(s.task||'Planned preventative maintenance')===task&&String(s.frequency||'')===frequency)
    || candidates.find(s=>String(s.frequency||'')===frequency)
    || candidates[0]||null;
}
function applySchedule(s){
  if(!s)return;
  pending=s;
  const set=(id,v)=>{const e=$(id);if(e)e.value=v??'';};
  set('ppmAsset',s.asset_code);set('ppmFrequency',s.frequency);set('ppmLast',s.last_completed);set('ppmNext',s.next_due);set('ppmAssigned',s.assigned_to);set('ppmCompletion',s.completion_status||'Scheduled');set('ppmTask',s.task);set('ppmNotes',s.notes);
  const modal=$('ppmModal');if(modal)modal.dataset.ppmScheduleId=s.id;
  const badge=$('ppmCompletionScheduleHint');
  if(badge)badge.textContent=`This completion will update ${s.asset_code} asset history.`;
}
function installUi(){
  const modal=$('ppmModal'); if(!modal)return false;
  if(!document.getElementById('ppmCompletionHistoryStyles')){
    const st=document.createElement('style');st.id='ppmCompletionHistoryStyles';st.textContent=`
      #ppmCompletionPanel{margin:12px 0 4px;padding:13px;border:1px solid #3e6657;border-radius:13px;background:#17372c;color:#eef7f2}
      #ppmCompletionPanel label{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
      #ppmCompletionPanel textarea{box-sizing:border-box;width:100%;min-height:62px;margin-top:7px;padding:9px;border-radius:9px;border:1px solid #55786b;background:#fff;color:#17211d;font:inherit;resize:vertical}
      #ppmCompletionPanel .ppmCompleteRow{display:flex;gap:9px;align-items:center;margin-top:9px}
      #ppmCompletionPanel button{min-height:42px;padding:9px 14px;border:0;border-radius:10px;background:#d9eee4;color:#17372c;font-weight:900}
      #ppmCompletionPanel small{font-size:10px;line-height:1.3;color:#bed3c9}
      @media(max-width:600px){#ppmCompletionPanel .ppmCompleteRow{align-items:stretch;flex-direction:column}#ppmCompletionPanel button{width:100%}}
    `;document.head.appendChild(st);
  }
  if($('ppmCompletionPanel'))return true;
  const actions=modal.querySelector('.modalActions'); if(!actions)return false;
  const panel=document.createElement('section');panel.id='ppmCompletionPanel';panel.innerHTML=`<label>Completion notes<textarea id="ppmCompletionNotes" placeholder="Optional notes, readings, findings or anything worth keeping in the asset history"></textarea></label><div class="ppmCompleteRow"><button type="button" id="completePpmNow">✓ Complete PPM</button><small id="ppmCompletionScheduleHint">Completion will be written to the asset history and the next due date calculated automatically.</small></div>`;
  actions.parentNode.insertBefore(panel,actions);
  $('completePpmNow').addEventListener('click',completeCurrent);
  return true;
}
async function completeCurrent(){
  const modal=$('ppmModal');const id=modal?.dataset?.ppmScheduleId||pending?.id;
  if(!id)return alert('I cannot identify this exact PPM schedule yet. Close it and reopen the PPM card, then try again.');
  const s=schedules.find(x=>x.id===id)||pending;
  if(!confirm(`Complete this PPM for ${s?.asset_code||'this asset'} and add it to the asset history?`))return;
  const btn=$('completePpmNow'),notes=$('ppmCompletionNotes')?.value?.trim()||'';
  if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    const c=client(); if(!c)throw new Error('Database connection unavailable');
    const {data,error}=await c.rpc('complete_ppm_schedule',{p_schedule_id:id,p_completion_notes:notes||null});
    if(error)throw error;
    await loadSchedules(true);
    const updated=schedules.find(x=>x.id===id); if(updated)applySchedule(updated);
    if($('ppmCompletionNotes'))$('ppmCompletionNotes').value='';
    await updateCompletedMetric();
    alert(`PPM completed. Asset history updated.${data?.next_due?` Next due ${data.next_due}.`:''}`);
    location.reload();
  }catch(err){
    console.error(err);alert(`PPM could not be completed: ${err?.message||err}`);
  }finally{if(btn){btn.disabled=false;btn.textContent='✓ Complete PPM';}}
}
async function updateCompletedMetric(){
  const el=$('ppmCompleted');if(!el)return;
  const c=client();if(!c)return;
  const now=new Date(),start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const next=new Date(now.getFullYear(),now.getMonth()+1,1),end=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
  const {count,error}=await c.from('maintenance_records').select('id',{count:'exact',head:true}).eq('work_type','PPM').gte('work_date',start).lt('work_date',end);
  if(!error&&typeof count==='number')el.textContent=count;
}
async function tagCards(){
  await loadSchedules();
  document.querySelectorAll('.ppmTaskCard[data-ppm]').forEach(card=>{const s=cardSchedule(card);if(s)card.dataset.ppmScheduleId=s.id;});
}
function init(){
  if(!installUi())return setTimeout(init,300);
  loadSchedules().then(()=>{tagCards();updateCompletedMetric();});
  const obs=new MutationObserver(()=>{installUi();tagCards();updateCompletedMetric();});
  obs.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const card=e.target.closest('.ppmTaskCard[data-ppm]');if(!card)return;
    const run=async()=>{await loadSchedules();const s=schedules.find(x=>x.id===card.dataset.ppmScheduleId)||cardSchedule(card);if(s)setTimeout(()=>{installUi();applySchedule(s);},30);};run();
  },true);
  const modal=$('ppmModal');if(modal)new MutationObserver(()=>{if(modal.getAttribute('aria-hidden')!=='true'){installUi();setTimeout(()=>{const id=modal.dataset.ppmScheduleId;const s=schedules.find(x=>x.id===id);if(s)applySchedule(s);},40);}}).observe(modal,{attributes:true,attributeFilter:['aria-hidden','class','style']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
