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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addElectricalTile, { once: true });
  } else {
    addElectricalTile();
  }
})();
