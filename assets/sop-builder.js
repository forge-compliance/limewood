// Limewood SOP Builder v1
// Creates and edits controlled SOP records directly in the SOP Library.
(() => {
  'use strict';

  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;

  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MARKER='LW_SOP_BUILDER_V1:';
  let editingId=null;
  let directory={buildings:[],rooms:[]};

  function isSopLibrary(){
    return ($('#documentViewTitle')?.textContent||'').trim()==='SOP Library';
  }

  function parseDescription(value){
    const s=String(value||'');
    if(!s.startsWith(MARKER)) return {notes:s};
    try{return JSON.parse(s.slice(MARKER.length));}catch{return {notes:s};}
  }

  function serialize(data){return MARKER+JSON.stringify(data);}

  async function loadDirectory(){
    try{
      const [b,r]=await Promise.all([
        db.from('buildings').select('id,name').order('name'),
        db.from('plant_rooms').select('id,name,building_id').order('name')
      ]);
      directory={buildings:b.data||[],rooms:r.data||[]};
    }catch(e){console.warn('SOP builder directory load failed',e);}
  }

  async function nextNumber(){
    const {data}=await db.from('sops').select('sop_number');
    let max=0;
    for(const row of data||[]){
      const m=String(row.sop_number||'').match(/SOP[^0-9]*(\d+)/i);
      if(m)max=Math.max(max,Number(m[1])||0);
    }
    return `SOP-${String(max+1).padStart(3,'0')}`;
  }

  function injectStyle(){
    if($('#lwSopBuilderStyle'))return;
    const s=document.createElement('style');
    s.id='lwSopBuilderStyle';
    s.textContent=`
      .lwSopCreateBtn{margin-left:10px;border:0;border-radius:10px;background:#17372c;color:#fff;padding:11px 15px;font-weight:800;cursor:pointer}
      .lwSopBuilder{position:fixed;inset:0;background:#0009;z-index:12000;display:none;align-items:flex-end;justify-content:center}
      .lwSopBuilder.open{display:flex}.lwSopSheet{width:min(900px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:20px 20px 0 0;padding:18px;box-sizing:border-box}
      .lwSopTop{display:flex;justify-content:space-between;gap:12px;align-items:center}.lwSopTop h2{margin:2px 0 0;color:#17372c}.lwSopTop button{border:0;border-radius:9px;padding:9px 12px;font-weight:800}
      .lwSopGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.lwSopGrid .wide{grid-column:1/-1}.lwSopGrid label{font-size:12px;font-weight:800;color:#455149}.lwSopGrid input,.lwSopGrid select,.lwSopGrid textarea{width:100%;box-sizing:border-box;margin-top:5px;padding:11px;border:1px solid #d6dad6;border-radius:10px;background:#fbfcfa;color:#1d2823;font:inherit}.lwSopGrid textarea{min-height:84px;resize:vertical}
      .lwSopActions{display:flex;gap:10px;justify-content:flex-end;margin-top:15px;position:sticky;bottom:-18px;background:#fff;padding:12px 0 4px}.lwSopActions button{border:0;border-radius:10px;padding:12px 16px;font-weight:800}.lwSopSave{background:#17372c;color:#fff}.lwSopMessage{font-size:13px;margin-top:8px}.lwSopEditBtn{display:inline-block;margin-top:10px;border:1px solid #b9c7bf;background:#f8faf8;color:#17372c;border-radius:9px;padding:8px 11px;font-weight:800;cursor:pointer}
      @media(max-width:650px){.lwSopGrid{grid-template-columns:1fr}.lwSopGrid .wide{grid-column:auto}.lwSopSheet{padding:15px}.lwSopCreateBtn{width:100%;margin:10px 0 0}}
    `;
    document.head.appendChild(s);
  }

  function injectModal(){
    if($('#lwSopBuilder'))return;
    const modal=document.createElement('div');
    modal.id='lwSopBuilder';modal.className='lwSopBuilder';
    modal.innerHTML=`<section class="lwSopSheet">
      <div class="lwSopTop"><div><small>LIMEWOOD ENGINEERING</small><h2 id="lwSopHeading">Create SOP</h2></div><button type="button" id="lwSopClose">Close</button></div>
      <div class="lwSopGrid">
        <label>SOP number<input id="lwSopNumber" placeholder="SOP-001"></label>
        <label>Revision<input id="lwSopRevision" value="1"></label>
        <label class="wide">Title<input id="lwSopTitle" placeholder="e.g. Spa plant room isolation procedure"></label>
        <label>Category<input id="lwSopCategory" placeholder="e.g. Water Systems"></label>
        <label>Status<select id="lwSopStatus"><option value="draft">Draft</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="superseded">Superseded</option></select></label>
        <label>Building<select id="lwSopBuilding"><option value="">Estate-wide</option></select></label>
        <label>Plant room<select id="lwSopRoom"><option value="">No plant room</option></select></label>
        <label>Author<input id="lwSopAuthor"></label>
        <label>Approved by<input id="lwSopApprovedBy"></label>
        <label>Issue date<input id="lwSopIssueDate" type="date"></label>
        <label>Review date<input id="lwSopReviewDate" type="date"></label>
        <label class="wide">Purpose<textarea id="lwSopPurpose" placeholder="What this procedure is for"></textarea></label>
        <label class="wide">Scope<textarea id="lwSopScope" placeholder="Where and when this SOP applies"></textarea></label>
        <label class="wide">PPE / equipment<textarea id="lwSopPpe" placeholder="Required PPE, tools and equipment"></textarea></label>
        <label class="wide">Isolation / safety precautions<textarea id="lwSopIsolation" placeholder="Required isolations, permits and safety controls"></textarea></label>
        <label class="wide">Procedure steps<textarea id="lwSopSteps" placeholder="1. ...\n2. ...\n3. ..."></textarea></label>
        <label class="wide">Emergency / abnormal conditions<textarea id="lwSopEmergency" placeholder="What to do if the procedure cannot be completed safely"></textarea></label>
        <label class="wide">Notes<textarea id="lwSopNotes" placeholder="Any additional notes"></textarea></label>
      </div>
      <div id="lwSopMessage" class="lwSopMessage"></div>
      <div class="lwSopActions"><button type="button" id="lwSopCancel">Cancel</button><button type="button" id="lwSopSave" class="lwSopSave">Save SOP</button></div>
    </section>`;
    document.body.appendChild(modal);
    $('#lwSopClose').onclick=close;
    $('#lwSopCancel').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    $('#lwSopSave').onclick=save;
    $('#lwSopBuilding').addEventListener('change',populateRooms);
  }

  function populateBuildings(){
    const el=$('#lwSopBuilding');if(!el)return;
    const old=el.value;
    el.innerHTML='<option value="">Estate-wide</option>'+directory.buildings.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    el.value=old;
    populateRooms();
  }

  function populateRooms(){
    const b=$('#lwSopBuilding')?.value||'';
    const el=$('#lwSopRoom');if(!el)return;
    const old=el.value;
    const rows=b?directory.rooms.filter(r=>String(r.building_id)===String(b)):directory.rooms;
    el.innerHTML='<option value="">No plant room</option>'+rows.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    if(rows.some(r=>String(r.id)===String(old)))el.value=old;
  }

  function setVal(id,v){const el=$(id);if(el)el.value=v||'';}
  function val(id){return $(id)?.value?.trim()||'';}

  async function open(id=null){
    editingId=id||null;
    $('#lwSopMessage').textContent='';
    populateBuildings();
    if(!id){
      $('#lwSopHeading').textContent='Create SOP';
      setVal('#lwSopNumber',await nextNumber());setVal('#lwSopRevision','1');setVal('#lwSopStatus','draft');
      ['#lwSopTitle','#lwSopCategory','#lwSopAuthor','#lwSopApprovedBy','#lwSopIssueDate','#lwSopReviewDate','#lwSopBuilding','#lwSopRoom','#lwSopPurpose','#lwSopScope','#lwSopPpe','#lwSopIsolation','#lwSopSteps','#lwSopEmergency','#lwSopNotes'].forEach(x=>setVal(x,''));
      populateRooms();
    }else{
      $('#lwSopHeading').textContent='Edit SOP';
      const {data,error}=await db.from('sops').select('*').eq('id',id).single();
      if(error){alert(error.message);return;}
      const d=parseDescription(data.description);
      setVal('#lwSopNumber',data.sop_number);setVal('#lwSopRevision',data.revision||'1');setVal('#lwSopTitle',data.title);setVal('#lwSopCategory',data.category);setVal('#lwSopStatus',data.status||'draft');setVal('#lwSopAuthor',data.author);setVal('#lwSopApprovedBy',data.approved_by);setVal('#lwSopIssueDate',data.issue_date);setVal('#lwSopReviewDate',data.review_date);setVal('#lwSopBuilding',data.building_id);populateRooms();setVal('#lwSopRoom',data.plant_room_id);setVal('#lwSopPurpose',d.purpose);setVal('#lwSopScope',d.scope);setVal('#lwSopPpe',d.ppe);setVal('#lwSopIsolation',d.isolation);setVal('#lwSopSteps',d.steps);setVal('#lwSopEmergency',d.emergency);setVal('#lwSopNotes',d.notes);
    }
    $('#lwSopBuilder').classList.add('open');document.body.classList.add('modal-open');
  }

  function close(){
    $('#lwSopBuilder')?.classList.remove('open');document.body.classList.remove('modal-open');
  }

  async function save(){
    const button=$('#lwSopSave');const msg=$('#lwSopMessage');
    const number=val('#lwSopNumber'),title=val('#lwSopTitle');
    if(!number||!title){msg.textContent='SOP number and title are required.';return;}
    const {data:sessionData}=await db.auth.getSession();
    const userId=sessionData?.session?.user?.id;
    if(!userId){msg.textContent='Sign in again before saving.';return;}
    const detail={purpose:val('#lwSopPurpose'),scope:val('#lwSopScope'),ppe:val('#lwSopPpe'),isolation:val('#lwSopIsolation'),steps:val('#lwSopSteps'),emergency:val('#lwSopEmergency'),notes:val('#lwSopNotes')};
    const payload={sop_number:number,title,category:val('#lwSopCategory')||'General',description:serialize(detail),revision:val('#lwSopRevision')||'1',status:val('#lwSopStatus')||'draft',author:val('#lwSopAuthor')||null,approved_by:val('#lwSopApprovedBy')||null,issue_date:val('#lwSopIssueDate')||null,review_date:val('#lwSopReviewDate')||null,building_id:val('#lwSopBuilding')||null,plant_room_id:val('#lwSopRoom')||null,updated_by:userId};
    button.disabled=true;button.textContent='Saving…';msg.textContent='Saving SOP…';
    try{
      let result;
      if(editingId){result=await db.from('sops').update(payload).eq('id',editingId).select('id').single();}
      else{result=await db.from('sops').insert({...payload,created_by:userId}).select('id').single();}
      if(result.error)throw result.error;
      msg.textContent='SOP saved.';
      setTimeout(()=>location.reload(),450);
    }catch(e){msg.textContent=e?.message||String(e);button.disabled=false;button.textContent='Save SOP';}
  }

  async function decorate(){
    if(!isSopLibrary())return;
    const hero=$('#documentView .documentHero');
    if(hero&&!$('#lwSopCreateBtn')){
      const b=document.createElement('button');b.id='lwSopCreateBtn';b.className='lwSopCreateBtn';b.type='button';b.textContent='+ Create SOP';b.onclick=()=>open();
      hero.appendChild(b);
    }
    const {data}=await db.from('sops').select('id,sop_number,title,description');
    for(const card of document.querySelectorAll('#documentGrid .documentCard')){
      if(card.querySelector('.lwSopEditBtn'))continue;
      const num=(card.querySelector('.documentNumber')?.textContent||'').trim();
      const row=(data||[]).find(x=>String(x.sop_number||'').trim()===num);
      if(!row)continue;
      const btn=document.createElement('button');btn.type='button';btn.className='lwSopEditBtn';btn.textContent='View / edit SOP';btn.onclick=()=>open(row.id);card.appendChild(btn);
      const d=parseDescription(row.description);
      if(d.purpose){const p=document.createElement('p');p.style.cssText='margin:9px 0 0;color:#68736d;font-size:12px';p.textContent=d.purpose.length>120?d.purpose.slice(0,117)+'…':d.purpose;card.appendChild(p);}
    }
  }

  async function init(){
    injectStyle();injectModal();await loadDirectory();
    const observer=new MutationObserver(()=>setTimeout(decorate,80));
    const target=$('#documentView')||document.body;observer.observe(target,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click',()=>setTimeout(decorate,80));
    setTimeout(decorate,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
