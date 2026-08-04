(() => {
  'use strict';

  const base = Array.isArray(window.LIMEWOOD_ASSETS) ? window.LIMEWOOD_ASSETS : [];
  const data = base.map(asset => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(`lw-${asset.id}`) || '{}');
    } catch (_) {
      saved = {};
    }
    return { ...asset, ...saved };
  });

  const els = {
    grid: document.getElementById('grid'),
    search: document.getElementById('search'),
    room: document.getElementById('room'),
    category: document.getElementById('category'),
    completeness: document.getElementById('completeness'),
    totalCount: document.getElementById('totalCount'),
    roomsCount: document.getElementById('roomsCount'),
    surveyedCount: document.getElementById('surveyedCount'),
    reviewCount: document.getElementById('reviewCount'),
    photoCount: document.getElementById('photoCount'),
    resultCount: document.getElementById('resultCount'),
    modal: document.getElementById('modal'),
    modalImage: document.getElementById('mImg'),
    modalId: document.getElementById('mId'),
    modalName: document.getElementById('mName'),
    modalDetails: document.getElementById('mDetails'),
    modalNotes: document.getElementById('mNotes'),
    modalStatus: document.getElementById('mStatus'),
    saveButton: document.getElementById('saveBtn'),
    exportButton: document.getElementById('exportBtn'),
    closeButton: document.querySelector('.close'),
    previousButton: document.getElementById('prevBtn'),
    nextButton: document.getElementById('nextBtn'),
    backButton: document.getElementById('backBtn')
  };

  let current = null;
  let visibleRows = [];

  const imagePath = asset => {
    if (!asset.photo) return 'assets/images/asset-placeholder.svg';
    let folder = 'coach-house';
    if (asset.room.startsWith('Staff')) folder = 'staff-house';
    if (asset.room.startsWith('Main')) folder = 'main-house';
    return `assets/images/${folder}/${asset.photo}`;
  };

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function updateStats() {
    els.totalCount.textContent = data.length;
    els.roomsCount.textContent = new Set(data.map(a => a.room)).size;
    els.surveyedCount.textContent = data.filter(a => ['Surveyed', 'Verified'].includes(a.status)).length;
    els.reviewCount.textContent = data.filter(a => ['Needs review', 'Limited access'].includes(a.status)).length;
    els.photoCount.textContent = data.filter(a => a.photo).length;
  }

  function populateFilters() {
    [...new Set(data.map(a => a.room))].sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      els.room.appendChild(option);
    });

    [...new Set(data.map(a => a.category))].sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      els.category.appendChild(option);
    });
  }

  function render() {
    const query = els.search.value.trim().toLowerCase();
    const selectedRoom = els.room.value;
    const selectedCategory = els.category.value;
    const selectedCompleteness = els.completeness.value;

    const rows = data.filter(asset => {
      const matchesRoom = !selectedRoom || asset.room === selectedRoom;
      const matchesCategory = !selectedCategory || asset.category === selectedCategory;
      const matchesQuery = !query || JSON.stringify(asset).toLowerCase().includes(query);
      const missingValues = [asset.manufacturer, asset.model, asset.serial, asset.electricalIsolation, asset.mechanicalIsolation, asset.manual].some(value => !value || /to be confirmed|unknown|not assessed|to verify|to be added/i.test(String(value)));
      const matchesCompleteness = !selectedCompleteness || (selectedCompleteness === 'missing' ? missingValues : !missingValues);
      return matchesRoom && matchesCategory && matchesQuery && matchesCompleteness;
    });

    visibleRows = rows;
    els.resultCount.textContent = `${rows.length} assets`;
    els.grid.innerHTML = rows.map(asset => `
      <article class="card" data-id="${escapeHtml(asset.id)}" role="button" tabindex="0" aria-label="Open ${escapeHtml(asset.name)}">
        <img loading="lazy" src="${escapeHtml(imagePath(asset))}" alt="${escapeHtml(asset.name)}" onerror="this.src='assets/images/asset-placeholder.svg'">
        <div class="cardBody">
          <div class="topline">
            <span class="badge">${escapeHtml(asset.id)}</span>
            <span class="status">${escapeHtml(asset.status)}</span>
          </div>
          <h4>${escapeHtml(asset.name)}</h4>
          <div class="meta">${escapeHtml(asset.room)}<br>${escapeHtml(asset.manufacturer)} · ${escapeHtml(asset.model)}</div>
          <button type="button" class="openAssetBtn" data-id="${escapeHtml(asset.id)}">Open asset details</button>
        </div>
      </article>
    `).join('');
  }

  function openAsset(id) {
    console.log('Opening asset', id);
    current = data.find(asset => asset.id === id);
    if (!current) return;

    els.modalImage.src = imagePath(current);
    els.modalImage.alt = current.name;
    els.modalId.textContent = current.id;
    els.modalName.textContent = current.name;
    els.modalDetails.innerHTML = [
      ['Plant room', current.room],
      ['Category', current.category],
      ['System / duty', current.system],
      ['Manufacturer', current.manufacturer],
      ['Model', current.model],
      ['Serial number', current.serial],
      ['Condition', current.condition],
      ['Criticality', current.criticality],
      ['Electrical isolation', current.electricalIsolation],
      ['Mechanical isolation', current.mechanicalIsolation],
      ['Isolation procedure', current.isolationProcedure],
      ['Manufacturer manual', current.manual],
      ['PPM frequency', current.ppm]
    ].map(([label, value]) => `<div><small>${escapeHtml(label)}</small>${escapeHtml(value || 'To be confirmed')}</div>`).join('');
    els.modalNotes.value = current.notes || '';
    els.modalStatus.value = current.status || 'Needs review';
    els.modal.classList.add('open');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const currentIndex = visibleRows.findIndex(asset => asset.id === current.id);
    els.previousButton.disabled = currentIndex <= 0;
    els.nextButton.disabled = currentIndex < 0 || currentIndex >= visibleRows.length - 1;
    els.closeButton.focus();
  }

  function closeAsset() {
    els.modal.classList.remove('open');
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  els.grid.addEventListener('click', event => {
    const target = event.target.closest('[data-id]');
    if (target && els.grid.contains(target)) openAsset(target.dataset.id);
  });

  els.grid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.card')) {
      event.preventDefault();
      openAsset(event.target.dataset.id);
    }
  });

  els.saveButton.addEventListener('click', () => {
    if (!current) return;
    current.notes = els.modalNotes.value;
    current.status = els.modalStatus.value;
    localStorage.setItem(`lw-${current.id}`, JSON.stringify({ notes: current.notes, status: current.status }));
    closeAsset();
    updateStats();
    render();
  });

  els.closeButton.addEventListener('click', closeAsset);
  els.modal.addEventListener('click', event => {
    if (event.target === els.modal) closeAsset();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && els.modal.classList.contains('open')) closeAsset();
  });

  [els.search, els.room, els.category, els.completeness].forEach(element => element.addEventListener('input', render));

  document.querySelectorAll('.nav').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      els.room.value = button.dataset.room || '';
      render();
    });
  });


  function openAdjacent(offset) {
    if (!current) return;
    const index = visibleRows.findIndex(asset => asset.id === current.id);
    const next = visibleRows[index + offset];
    if (next) openAsset(next.id);
  }

  els.previousButton.addEventListener('click', () => openAdjacent(-1));
  els.nextButton.addEventListener('click', () => openAdjacent(1));
  els.backButton.addEventListener('click', closeAsset);


  els.exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'limewood-asset-updates.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  });


  const dashboardView = document.getElementById('dashboardView');
  const registerView = document.getElementById('registerView');
  const placeholderView = document.getElementById('placeholderView');
  const registerTitle = document.getElementById('registerTitle');
  const drawer = document.getElementById('drawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const menuBtn = document.getElementById('menuBtn');
  const closeDrawerBtn = document.getElementById('closeDrawer');

  function closeDrawer(){ drawer.classList.remove('open'); drawerBackdrop.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
  function openDrawer(){ drawer.classList.add('open'); drawerBackdrop.classList.add('open'); drawer.setAttribute('aria-hidden','false'); }
  function showView(name){
    dashboardView.hidden = name !== 'dashboard';
    registerView.hidden = name !== 'register';
    placeholderView.hidden = name !== 'placeholder';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function showRegister(roomValue=''){
    showView('register');
    els.room.value = roomValue;
    registerTitle.textContent = roomValue ? roomValue.replace(' Plant Room',' Asset Register') : 'Estate Asset Register';
    render();
    closeDrawer();
  }
  function showPlaceholder(title){
    document.getElementById('placeholderTitle').textContent = title;
    showView('placeholder');
    closeDrawer();
  }
  menuBtn.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  document.getElementById('drawerNav').addEventListener('click', event => {
    const btn = event.target.closest('button'); if(!btn) return;
    if(btn.dataset.view === 'dashboard'){ showView('dashboard'); closeDrawer(); }
    else if(btn.dataset.view === 'search'){ showRegister(''); setTimeout(()=>els.search.focus(),250); }
    else if('room' in btn.dataset){ showRegister(btn.dataset.room || ''); }
    else if(btn.dataset.placeholder){ showPlaceholder(btn.dataset.placeholder); }
  });
  document.querySelectorAll('[data-estate-room]').forEach(btn=>btn.addEventListener('click',()=>showRegister(btn.dataset.estateRoom)));
  document.querySelectorAll('.estateGrid [data-placeholder]').forEach(btn=>btn.addEventListener('click',()=>showPlaceholder(btn.dataset.placeholder)));
  document.getElementById('backDashboard').addEventListener('click',()=>showView('dashboard'));
  showView('dashboard');

  populateFilters();
  updateStats();
  render();
})();
