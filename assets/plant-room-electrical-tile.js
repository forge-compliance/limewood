/* Adds the dedicated Electrical route to every Plant Room hub. */
(() => {
  'use strict';

  function addElectricalTile() {
    const grid = document.querySelector('#plantRoomHubView .plantHubGrid');
    if (!grid || grid.querySelector('[data-hub-action="electrical"]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.hubAction = 'electrical';
    button.innerHTML = '<span>⚡</span><b>Electrical</b><small>Distribution boards, circuits &amp; isolations</small>';

    const assets = grid.querySelector('[data-hub-action="assets"]');
    if (assets?.nextSibling) grid.insertBefore(button, assets.nextSibling);
    else grid.prepend(button);
  }

  function installStaffHouseSchematicRoute(){
    const hub=document.getElementById('plantRoomHubView');
    if(!hub || hub.dataset.staffElectricalRoute==='1') return;
    hub.dataset.staffElectricalRoute='1';

    hub.addEventListener('click', event=>{
      const button=event.target.closest('[data-hub-action="electrical"]');
      if(!button) return;

      const room=String(document.getElementById('hubRoomTitle')?.textContent||'').trim().toLowerCase();
      if(!room.includes('staff house')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      location.href='/staff-house-electrical.html';
    }, true);
  }

  function init(){
    addElectricalTile();
    installStaffHouseSchematicRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
