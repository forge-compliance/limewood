// SOP card cleanup: structured SOPs are app records, not uploaded files.
(()=>{
'use strict';
const isSopCard=card=>/SOP[-\s]?\d+/i.test(card?.textContent||'');
function clean(){
  const view=document.querySelector('#documentView');
  if(!view||view.hidden)return;
  document.querySelectorAll('#documentGrid .documentCard').forEach(card=>{
    if(!isSopCard(card))return;
    [...card.querySelectorAll('button,a,span,small,div')].forEach(el=>{
      if((el.textContent||'').trim().toLowerCase()==='file unavailable'){
        el.hidden=true;
        el.style.display='none';
      }
    });
  });
}
const view=document.querySelector('#documentView');
if(view)new MutationObserver(clean).observe(view,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
document.addEventListener('click',()=>setTimeout(clean,0));
setTimeout(clean,50);
setTimeout(clean,300);
})();
