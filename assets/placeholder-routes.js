(() => {
  'use strict';

  const systemViews = new Set([
    'Photo Library',
    'Water Systems',
    'Heating Systems',
    'Chilled Water Systems',
    'Lighting',
    'Fire & Life Safety',
    'Pool & Spa Water Treatment',
    'Settings'
  ]);

  const estateViews = new Set(['Spa','Pavilion','Barn','Forest Cottage']);

  function go(view, kind='system') {
    const u = new URL('/systems.html', location.origin);
    u.searchParams.set('view', view);
    u.searchParams.set('kind', kind);
    location.href = u.toString();
  }

  // Capture clicks before the legacy placeholder handler turns them into a dead-end screen.
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-placeholder]');
    if (p) {
      const name = p.dataset.placeholder || '';
      if (systemViews.has(name) || estateViews.has(name)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        go(name, estateViews.has(name) ? 'location' : 'system');
        return;
      }
    }

    const hub = e.target.closest('[data-hub-action]');
    if (!hub) return;
    const action = hub.dataset.hubAction;
    const room = document.getElementById('hubRoomTitle')?.textContent?.trim() || '';

    if (action === 'notes') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const u = new URL('/maintenance-dashboard.html', location.origin);
      if (room) u.searchParams.set('plantRoom', room);
      location.href = u.toString();
    }

    if (action === 'photos') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const u = new URL('/systems.html', location.origin);
      u.searchParams.set('view', 'Photo Library');
      u.searchParams.set('kind', 'system');
      if (room) u.searchParams.set('room', room);
      location.href = u.toString();
    }
  }, true);
})();
