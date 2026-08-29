/* Keep repeated camera captures in one pending Photo Inbox batch and stop duplicate asset creation. */
(() => {
  'use strict';

  function install() {
    if (!/\/photo-inbox\.html$/i.test(location.pathname)) return;
    const input = document.getElementById('photoFiles');
    if (!input || input.dataset.batchInstalled === '1') return;
    input.dataset.batchInstalled = '1';

    const pending = [];
    const seen = new Set();
    let currentReviewId = null;
    let bypassDuplicateCheck = false;

    /* Asset types are a user choice, not a consequence of the current room filter.
       Keep Valve available even when the selected building/location has no assets
       currently categorised as Valve. */
    const categoryFilter = document.getElementById('assetCategoryFilter');
    function keepValveOption() {
      if (!categoryFilter) return;
      const hasValve = [...categoryFilter.options].some(o => String(o.value || o.textContent).trim().toLowerCase() === 'valve');
      if (!hasValve) categoryFilter.add(new Option('Valve', 'Valve'));
    }
    if (categoryFilter) {
      keepValveOption();
      new MutationObserver(keepValveOption).observe(categoryFilter, { childList: true });
      document.getElementById('assetBuildingFilter')?.addEventListener('change', () => setTimeout(keepValveOption, 0));
      document.getElementById('assetRoomFilter')?.addEventListener('change', () => setTimeout(keepValveOption, 0));
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:10px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap';
    const count = document.createElement('strong');
    count.style.cssText = 'font-size:13px;color:#17372c';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear photos';
    clear.style.cssText = 'display:none;border:1px solid #b9c7bf;background:#fff;color:#17372c;padding:7px 10px;border-radius:9px;font-weight:700';
    wrap.append(count, clear);
    input.insertAdjacentElement('afterend', wrap);

    function key(file) { return [file.name, file.size, file.lastModified].join('|'); }
    function sync() {
      const dt = new DataTransfer();
      pending.forEach(file => dt.items.add(file));
      input.files = dt.files;
      count.textContent = pending.length ? `${pending.length} photo${pending.length === 1 ? '' : 's'} ready. Tap Select photos to add more.` : 'No photos selected yet.';
      clear.style.display = pending.length ? 'inline-block' : 'none';
    }

    input.addEventListener('change', () => {
      Array.from(input.files || []).forEach(file => {
        const k = key(file);
        if (!seen.has(k)) { seen.add(k); pending.push(file); }
      });
      sync();
    });

    clear.addEventListener('click', () => { pending.length = 0; seen.clear(); input.value = ''; sync(); });

    const uploadButton = document.getElementById('uploadBtn');
    uploadButton?.addEventListener('click', () => {
      setTimeout(() => { if (!input.files.length) { pending.length = 0; seen.clear(); sync(); } }, 250);
    });

    document.addEventListener('click', event => {
      const review = event.target.closest?.('[data-review]');
      if (review?.dataset?.review) currentReviewId = review.dataset.review;
    }, true);

    const suggest = document.getElementById('createSuggested');
    const status = document.getElementById('reviewStatus');

    suggest?.addEventListener('click', async event => {
      if (bypassDuplicateCheck) { bypassDuplicateCheck = false; return; }
      if (!currentReviewId || !window.supabase || !window.LIMEWOOD_CONFIG) return;
      event.preventDefault(); event.stopImmediatePropagation(); suggest.disabled = true;
      if (status) { status.className = 'reviewStatus'; status.textContent = 'Checking for an existing asset first…'; }

      try {
        const cfg = window.LIMEWOOD_CONFIG;
        const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
        const { data, error } = await client.functions.invoke('photo-duplicate-check', { body: { action: 'check', id: currentReviewId } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const match = data?.matches?.[0];
        if (match) {
          const reason = Array.isArray(match.reasons) && match.reasons.length ? `\nMatch: ${match.reasons.join(', ')}` : '';
          const useExisting = confirm(`Possible existing asset found:\n\n${match.asset_code} · ${match.asset_name}${match.room_name ? `\n${match.room_name}` : ''}${reason}\n\nUse this existing asset instead of creating another one?`);
          if (useExisting) {
            if (status) status.textContent = `Assigning to ${match.asset_code}…`;
            let assigned;
            if (match.source === 'electrical') {
              const result = await client.functions.invoke('photo-duplicate-check', { body: { action: 'assign_existing_electrical', id: currentReviewId, electrical_asset_id: match.id } });
              if (result.error) throw result.error;
              if (result.data?.error) throw new Error(result.data.error);
              assigned = result.data?.asset;
            } else {
              const result = await client.functions.invoke('photo-ai-file', { body: { action: 'approve', id: currentReviewId, asset_id: match.id } });
              if (result.error) throw result.error;
              if (result.data?.error) throw new Error(result.data.error);
              assigned = result.data?.asset;
            }
            if (status) { status.className = 'reviewStatus success'; status.textContent = `Assigned to existing ${assigned?.asset_code || match.asset_code} · ${assigned?.asset_name || match.asset_name}`; }
            setTimeout(() => location.reload(), 700); return;
          }
        }
        bypassDuplicateCheck = true; suggest.disabled = false; suggest.click();
      } catch (err) {
        if (status) { status.className = 'reviewStatus error'; status.textContent = 'Duplicate check failed, so no new asset was created. ' + (err?.message || String(err)); }
      } finally { suggest.disabled = false; }
    }, true);

    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
