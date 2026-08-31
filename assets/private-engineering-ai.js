/* Private Engineering AI panel.
   UI is shown only to the authorised Limewood maintenance account.
   The Edge Function independently enforces the same user restriction. */
(() => {
  'use strict';

  const AUTHORIZED_USER_ID='28a012be-bfe4-42a0-9d20-8746d12c8aa8';
  const cfg=window.LIMEWOOD_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey) return;

  const aiClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let authorised=false;
  let pendingMessage='';

  function styles(){
    if(document.getElementById('engineeringAiStyles')) return;
    const s=document.createElement('style');
    s.id='engineeringAiStyles';
    s.textContent=`
      #engineeringAiModal{position:fixed;inset:0;background:rgba(10,20,16,.58);z-index:12000;display:none;align-items:flex-end;justify-content:center;padding:12px}
      #engineeringAiModal.open{display:flex}
      .engineeringAiCard{width:min(720px,100%);max-height:88vh;background:#fff;border-radius:18px 18px 10px 10px;box-shadow:0 18px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
      .engineeringAiHead{display:flex;align-items:center;gap:12px;padding:16px 18px;background:#17372c;color:#fff}
      .engineeringAiHead .aiMark{width:38px;height:38px;border-radius:10px;background:#fff;color:#17372c;display:grid;place-items:center;font-size:20px}
      .engineeringAiHead div:nth-child(2){flex:1}.engineeringAiHead b{display:block;font-size:16px}.engineeringAiHead small{opacity:.8}
      .engineeringAiClose{border:0;background:transparent;color:#fff;font-size:26px;padding:4px 8px}
      .engineeringAiMessages{padding:16px;overflow:auto;min-height:240px;display:flex;flex-direction:column;gap:10px;background:#f5f7f6}
      .engineeringAiMsg{max-width:88%;padding:10px 12px;border-radius:12px;line-height:1.4;white-space:pre-wrap}
      .engineeringAiMsg.user{align-self:flex-end;background:#17372c;color:#fff}.engineeringAiMsg.ai{align-self:flex-start;background:#fff;border:1px solid #dce5e1;color:#183129}
      .engineeringAiMsg.error{align-self:flex-start;background:#fff0f0;color:#8a2020;border:1px solid #e8c8c8}
      .engineeringAiConfirm{margin:0 16px 10px;padding:12px;border:1px solid #d5a339;background:#fff8e7;border-radius:12px;display:none}
      .engineeringAiConfirm.open{display:block}.engineeringAiConfirm button{margin-top:8px;width:100%;background:#17372c;color:#fff;border:0;border-radius:9px;padding:10px;font-weight:700}
      .engineeringAiComposer{display:flex;gap:8px;padding:12px;border-top:1px solid #dfe7e3;background:#fff}
      .engineeringAiComposer textarea{flex:1;resize:none;min-height:48px;max-height:130px;border:1px solid #bccbc4;border-radius:10px;padding:10px;font:inherit}
      .engineeringAiComposer button{border:0;border-radius:10px;background:#17372c;color:#fff;padding:0 18px;font-weight:700}
      .engineeringAiThinking{opacity:.65;font-style:italic}
      @media(min-width:760px){#engineeringAiModal{align-items:center}.engineeringAiCard{border-radius:18px}}
    `;
    document.head.appendChild(s);
  }

  function addMessage(text,type='ai',thinking=false){
    const box=document.getElementById('engineeringAiMessages');
    if(!box) return null;
    const m=document.createElement('div');
    m.className=`engineeringAiMsg ${type}${thinking?' engineeringAiThinking':''}`;
    m.textContent=text;
    box.appendChild(m);
    box.scrollTop=box.scrollHeight;
    return m;
  }

  function pageContext(){
    const visible=[...document.querySelectorAll('main > section')].find(x=>!x.hidden && getComputedStyle(x).display!=='none');
    return {
      url:location.pathname+location.search,
      view:visible?.id||'',
      plant_room:document.getElementById('hubRoomTitle')?.textContent?.trim()||'',
      building:document.getElementById('buildingHubTitle')?.textContent?.trim()||'',
      asset:document.getElementById('mId')?.textContent?.trim()||''
    };
  }

  async function sendMessage(confirmed=false){
    const input=document.getElementById('engineeringAiInput');
    const send=document.getElementById('engineeringAiSend');
    const confirmBox=document.getElementById('engineeringAiConfirm');
    const message=confirmed?pendingMessage:String(input?.value||'').trim();
    if(!message) return;
    if(!confirmed){ addMessage(message,'user'); input.value=''; }
    if(send) send.disabled=true;
    if(confirmBox) confirmBox.classList.remove('open');
    const wait=addMessage(confirmed?'Applying confirmed change…':'Checking the engineering database…','ai',true);
    try{
      const {data,error}=await aiClient.functions.invoke('engineering-ai-chat',{body:{message,context:pageContext(),confirmed}});
      wait?.remove();
      if(error) throw error;
      if(!data?.ok && data?.error) throw new Error(data.error);
      addMessage(data?.reply||'Done.','ai');
      if(data?.confirmation_required){
        pendingMessage=message;
        const text=document.getElementById('engineeringAiConfirmText');
        if(text) text.textContent='This will change the live engineering database. Review the AI response above, then confirm.';
        confirmBox?.classList.add('open');
      } else {
        pendingMessage='';
        if(data?.changed) window.dispatchEvent(new CustomEvent('limewood:engineering-ai:changed'));
      }
    }catch(err){
      wait?.remove();
      addMessage(`AI error: ${err?.message||err}`,'error');
    }finally{
      if(send) send.disabled=false;
    }
  }

  function buildPanel(){
    if(document.getElementById('engineeringAiModal')) return;
    styles();
    const modal=document.createElement('div');
    modal.id='engineeringAiModal';
    modal.innerHTML=`
      <section class="engineeringAiCard" role="dialog" aria-modal="true" aria-label="Engineering AI">
        <header class="engineeringAiHead"><div class="aiMark">🤖</div><div><b>Engineering AI</b><small>Private maintenance assistant</small></div><button class="engineeringAiClose" id="engineeringAiClose" aria-label="Close">×</button></header>
        <div id="engineeringAiMessages" class="engineeringAiMessages"><div class="engineeringAiMsg ai">Engineering AI ready. I can search the live estate records and carry out controlled database actions. Changes that need approval will ask first.</div></div>
        <div id="engineeringAiConfirm" class="engineeringAiConfirm"><div id="engineeringAiConfirmText"></div><button id="engineeringAiConfirmBtn">Confirm this change</button></div>
        <div class="engineeringAiComposer"><textarea id="engineeringAiInput" placeholder="Ask about an asset, plant room, recent photo, or tell me what needs changing…"></textarea><button id="engineeringAiSend">Send</button></div>
      </section>`;
    document.body.appendChild(modal);
    const close=()=>modal.classList.remove('open');
    document.getElementById('engineeringAiClose').addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    document.getElementById('engineeringAiSend').addEventListener('click',()=>sendMessage(false));
    document.getElementById('engineeringAiConfirmBtn').addEventListener('click',()=>sendMessage(true));
    document.getElementById('engineeringAiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(false);}});
  }

  function addButtons(){
    if(!authorised) return;
    buildPanel();
    const open=()=>document.getElementById('engineeringAiModal')?.classList.add('open');
    const nav=document.getElementById('drawerNav');
    if(nav&&!document.getElementById('engineeringAiNavBtn')){
      const b=document.createElement('button'); b.id='engineeringAiNavBtn'; b.type='button'; b.textContent='🤖 Engineering AI'; b.addEventListener('click',open); nav.prepend(b);
    }
    const quick=document.querySelector('#dashboardView .quickGrid');
    if(quick&&!document.getElementById('engineeringAiQuickBtn')){
      const b=document.createElement('button'); b.id='engineeringAiQuickBtn'; b.type='button'; b.innerHTML='<span>🤖</span><b>Engineering AI</b><small>Private estate assistant</small>'; b.addEventListener('click',open); quick.prepend(b);
    }
  }

  function removeButtons(){
    document.getElementById('engineeringAiNavBtn')?.remove();
    document.getElementById('engineeringAiQuickBtn')?.remove();
    document.getElementById('engineeringAiModal')?.remove();
  }

  async function syncAccess(){
    const {data}=await aiClient.auth.getSession();
    const uid=data?.session?.user?.id||'';
    authorised=uid===AUTHORIZED_USER_ID;
    if(authorised) addButtons(); else removeButtons();
  }

  function start(){
    syncAccess();
    aiClient.auth.onAuthStateChange(()=>setTimeout(syncAccess,0));
    const observer=new MutationObserver(()=>{if(authorised)addButtons();});
    observer.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
