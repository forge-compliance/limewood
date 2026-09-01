(()=>{
  const apply=()=>{
    const head=document.querySelector('.reviewAssistant .assistantHead');
    if(!head)return;
    const title=head.querySelector('b');
    if(title) title.textContent='Stan';
    const note=head.querySelector('small');
    if(note) note.remove();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();