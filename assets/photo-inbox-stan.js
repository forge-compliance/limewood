(()=>{
  const apply=()=>{
    const box=document.querySelector('.reviewAssistant');
    const head=box?.querySelector('.assistantHead');
    if(!box||!head)return;
    head.innerHTML=`<div class="stanIdentity"><div class="stanAvatar">S</div><div><div class="stanName">Stan</div><div class="stanPresence"><span></span> Photo review assistant</div></div></div>`;
    const input=box.querySelector('#chatInput');
    if(input) input.placeholder='Message Stan…';
    const send=box.querySelector('#chatSend');
    if(send) send.textContent='Send';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();