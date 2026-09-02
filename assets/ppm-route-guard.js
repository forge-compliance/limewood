/* Reliable PPM routing from every plant-room hub.
   Uses the application's canonical PPM Centre entry point, then narrows to the originating room when possible. */
(()=>{
  'use strict';

  const openPpmCentreForRoom=(room)=>{
    const drawerPpm=document.querySelector('#drawerNav button[data-view="ppm"]');
    if(!drawerPpm)return false;

    // Use the app's own PPM entry point so all normal state/rendering is preserved.
    drawerPpm.click();

    const applyRoom=()=>{
      const input=document.getElementById('ppmDirectorySearch');
      if(!input)return false;
      input.value=room||'';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    };

    if(room){
      if(!applyRoom()){
        let tries=0;
        const timer=setInterval(()=>{
          tries++;
          if(applyRoom()||tries>20)clearInterval(timer);
        },100);
      }
    }
    return true;
  };

  // Capture before legacy room handlers. This prevents a stale room mapping from
  // turning a valid PPM tile into a dead click.
  document.addEventListener('click',e=>{
    const tile=e.target.closest('#plantRoomHubView [data-hub-action="ppm"]');
    if(!tile)return;
    const room=document.getElementById('hubRoomTitle')?.textContent?.trim()||'';
    if(!document.querySelector('#drawerNav button[data-view="ppm"]'))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPpmCentreForRoom(room);
  },true);

  // Keep all generic PPM entry points canonical too. They already work through
  // app-core; this marker lets future generated links target one stable action.
  document.addEventListener('click',e=>{
    const link=e.target.closest('[data-ppm-centre-link]');
    if(!link)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openPpmCentreForRoom(link.dataset.ppmRoom||'');
  },true);
})();
