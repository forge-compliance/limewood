/* Limewood Supabase resilience layer.
   Bounded retries for transient network/API failures without creating request storms. */
(() => {
  'use strict';
  if (window.__LW_SUPABASE_RESILIENCE__) return;
  window.__LW_SUPABASE_RESILIENCE__ = true;

  const nativeFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const inflight = new Map();
  let lastAutoRefresh = 0;

  const isSupabase = input => {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      return /\.supabase\.co\//i.test(String(url || ''));
    } catch (_) { return false; }
  };

  const getUrl = input => {
    try { return typeof input === 'string' ? input : input?.url || ''; }
    catch (_) { return ''; }
  };

  const methodOf = init => String(init?.method || 'GET').toUpperCase();

  // Never retry authentication failures. They are not transient and retrying them
  // can create a browser-side request avalanche when a session is stale.
  const retryableStatus = status =>
    status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);

  const requestKey = (input, init) => `${methodOf(init)} ${getUrl(input)}`;

  async function runRequest(input, init) {
    const method = methodOf(init);
    const canRetry = method === 'GET' || method === 'HEAD';
    const delays = canRetry ? [0, 700] : [0];
    let lastError;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      try {
        const response = await nativeFetch(input, init);
        if (!canRetry || !retryableStatus(response.status) || attempt === delays.length - 1) return response;
        console.warn(`Limewood cloud retry ${attempt + 1}: HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        if (!canRetry || attempt === delays.length - 1) throw error;
        console.warn(`Limewood cloud retry ${attempt + 1}: ${error?.message || error}`);
      }
    }

    throw lastError || new Error('Supabase request failed');
  }

  window.fetch = function limewoodResilientFetch(input, init) {
    if (!isSupabase(input)) return nativeFetch(input, init);

    const method = methodOf(init);
    if (method !== 'GET' && method !== 'HEAD') return runRequest(input, init);

    // Coalesce identical concurrent reads. Multiple dashboard widgets often ask for
    // the same resource at once; one network request is enough, civilization survives.
    const key = requestKey(input, init);
    if (inflight.has(key)) return inflight.get(key).then(r => r.clone());

    const promise = runRequest(input, init)
      .finally(() => inflight.delete(key));

    inflight.set(key, promise);
    return promise.then(r => r.clone());
  };

  const guardedRefresh = delay => {
    const now = Date.now();
    if (now - lastAutoRefresh < 15000) return;
    lastAutoRefresh = now;
    const refresh = document.getElementById('refreshBtn');
    if (refresh && !refresh.disabled) setTimeout(() => refresh.click(), delay);
  };

  window.addEventListener('online', () => guardedRefresh(500));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const sync = document.getElementById('syncStatus');
    const text = String(sync?.textContent || '').toLowerCase();
    if (/failed|error|offline|connecting/.test(text)) guardedRefresh(700);
  });
})();
