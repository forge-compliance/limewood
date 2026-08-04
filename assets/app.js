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
    closeButton: document.querySelector('.close')
  };

  let current = null;

  const imagePath = asset => {
    const folder = asset.room.startsWith('Staff') ? 'staff-house' : 'coach-house';
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

    const rows = data.filter(asset => {
      const matchesRoom = !selectedRoom || asset.room === selectedRoom;
      const matchesCategory = !selectedCategory || asset.category === selectedCategory;
      const matchesQuery = !query || JSON.stringify(asset).toLowerCase().includes(query);
      return matchesRoom && matchesCategory && matchesQuery;
    });

    els.resultCount.textContent = `${rows.length} assets`;
    els.grid.innerHTML = rows.map(asset => `
      <article class="card" data-id="${escapeHtml(asset.id)}" role="button" tabindex="0" aria-label="Open ${escapeHtml(asset.name)}">
        <img loading="lazy" src="${escapeHtml(imagePath(asset))}" alt="${escapeHtml(asset.name)}">
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
      ['Manufacturer', current.manufacturer],
      ['Model', current.model],
      ['Serial', current.serial],
      ['PPM', current.ppm]
    ].map(([label, value]) => `<div><small>${escapeHtml(label)}</small>${escapeHtml(value || 'To be confirmed')}</div>`).join('');
    els.modalNotes.value = current.notes || '';
    els.modalStatus.value = current.status || 'Needs review';
    els.modal.classList.add('open');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
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

  [els.search, els.room, els.category].forEach(element => element.addEventListener('input', render));

  document.querySelectorAll('.nav').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      els.room.value = button.dataset.room || '';
      render();
    });
  });

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

  populateFilters();
  updateStats();
  render();
})();
