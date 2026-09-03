/* Make PPM dashboard summary cards actionable on mobile and desktop. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);

function showRegister(title){
  const directory=$('ppmDirectoryPanel');
  const register=$('ppmRegisterPanel');
  if(directory)directory.hidden=true;
  if(register)register.hidden=false;
  const room=$('ppmRoom');
  if(room){room.value='';room.dispatchEvent(new Event('input',{bubbles:true}));}
  const status=$('ppmStatus');
  if(status){status.value='';status.dispatchEvent(new Event('input',{bubbles:true}));}
  const heading=$('ppmRoomTitle');
  if(heading)heading.textContent=title;
}

function filterRendered(allowed,title){
  showRegister(title);
  requestAnimationFrame(()=>{
    const cards=[...document.querySelectorAll('#ppmCards .ppmTaskCard')];
    let shown=0;
    cards.forEach(card=>{
      const text=card.querySelector('.ppmStatus')?.textContent?.trim()||'';
      const keep=allowed.includes(text);
      card.hidden=!keep;
      if(keep)shown++;
    });
    const count=$('ppmRoomCount');
    if(count)count.textContent=`${shown} schedule${shown===1?'':'s'}`;
    $('ppmRegisterPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
}

function makeActionable(id,allowed,title){
  const metric=$(id)?.closest('.ppmStat');
  if(!metric)return;
  metric.tabIndex=0;
  metric.setAttribute('role','button');
  metric.setAttribute('aria-label',`Open ${title}`);
  metric.style.cursor='pointer';
  const open=()=>filterRendered(allowed,title);
  metric.addEventListener('click',open);
  metric.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
}

function init(){
  makeActionable('ppmOverdue',['Overdue'],'Overdue PPMs');
  makeActionable('ppmDueWeek',['Due this week'],'PPMs due this week');
  makeActionable('ppmDueMonth',['Due this week','Due this month'],'PPMs due in the next 30 days');
  makeActionable('ppmCompleted',['Complete'],'Completed PPMs this month');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
