/* Limewood Supabase resilience layer.
   Retries transient network/API/JWT gateway failures without changing RLS or credentials. */
(() => {
  'use strict';
  if (window.__LW_SUPABASE_RESILIENCE__) return;
  window.__LW_SUPABASE_RESILIENCE__ = true;

  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isSupabase = input => {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      return /\.supabase\.co\//i.test(String(url || ''));
    } catch (_) { return false; }
  };
  const retryableStatus = status => status === 401 || status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);

  window.fetch = async function limewoodResilientFetch(input, init) {
    if (!isSupabase(input)) return nativeFetch(input, init);

    const delays = [0, 450, 1200, 2500];
    let lastError;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      try {
        const response = await nativeFetch(input, init);
        if (!retryableStatus(response.status) || attempt === delays.length - 1) return response;
        console.warn(`Limewood cloud retry ${attempt + 1}: HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        console.warn(`Limewood cloud retry ${attempt + 1}:`, error?.message || error);
        if (attempt === delays.length - 1) throw error;
      }
    }
    throw lastError || new Error('Supabase request failed after retries');
  };

  // Re-sync when a phone/browser comes back online or returns to the foreground.
  window.addEventListener('online', () => {
    const refresh = document.getElementById('refreshBtn');
    if (refresh && !refresh.disabled) setTimeout(() => refresh.click(), 300);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const sync = document.getElementById('syncStatus');
    const text = String(sync?.textContent || '').toLowerCase();
    if (/failed|error|offline|connecting/.test(text)) {
      const refresh = document.getElementById('refreshBtn');
      if (refresh && !refresh.disabled) setTimeout(() => refresh.click(), 350);
    }
  });
})();
