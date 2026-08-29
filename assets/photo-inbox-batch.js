/* Keep repeated camera captures in one pending Photo Inbox batch. */
(() => {
  'use strict';

  function install() {
    if (!/\/photo-inbox\.html$/i.test(location.pathname)) return;
    const input = document.getElementById('photoFiles');
    if (!input || input.dataset.batchInstalled === '1') return;
    input.dataset.batchInstalled = '1';

    const pending = [];
    const seen = new Set();

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

    function key(file) {
      return [file.name, file.size, file.lastModified].join('|');
    }

    function sync() {
      const dt = new DataTransfer();
      pending.forEach(file => dt.items.add(file));
      input.files = dt.files;
      count.textContent = pending.length
        ? `${pending.length} photo${pending.length === 1 ? '' : 's'} ready. Tap Select photos to add more.`
        : 'No photos selected yet.';
      clear.style.display = pending.length ? 'inline-block' : 'none';
    }

    input.addEventListener('change', () => {
      const chosen = Array.from(input.files || []);
      chosen.forEach(file => {
        const k = key(file);
        if (!seen.has(k)) {
          seen.add(k);
          pending.push(file);
        }
      });
      sync();
    });

    clear.addEventListener('click', () => {
      pending.length = 0;
      seen.clear();
      input.value = '';
      sync();
    });

    const uploadButton = document.getElementById('uploadBtn');
    uploadButton?.addEventListener('click', () => {
      // The page's existing upload handler reads input.files. Once it has started,
      // leave the accumulated FileList intact; the existing code clears the input
      // after a successful upload.
      setTimeout(() => {
        if (!input.files.length) {
          pending.length = 0;
          seen.clear();
          sync();
        }
      }, 250);
    });

    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
