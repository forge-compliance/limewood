/* Limewood persistent authentication hardening.
   Keep the Supabase session in localStorage and refresh it before expiry. */
(() => {
  'use strict';

  const sb = window.supabase;
  if (!sb || typeof sb.createClient !== 'function') return;

  const originalCreateClient = sb.createClient.bind(sb);
  const storage = (() => {
    try {
      const test='__lw_auth_storage_test__';
      localStorage.setItem(test,'1');
      localStorage.removeItem(test);
      return localStorage;
    } catch (_) {
      return undefined;
    }
  })();

  sb.createClient = function(url, key, options = {}) {
    const auth = {
      ...(options.auth || {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options.auth?.detectSessionInUrl !== false
    };

    if (storage) auth.storage = storage;

    const client = originalCreateClient(url, key, {
      ...options,
      auth
    });

    // One light keep-alive per client. Supabase normally refreshes itself, this
    // simply gives mobile browsers another chance after sleeping/backgrounding.
    const refreshIfNeeded = async () => {
      try {
        const { data } = await client.auth.getSession();
        const session = data?.session;
        if (!session?.expires_at) return;
        const secondsLeft = session.expires_at - Math.floor(Date.now() / 1000);
        if (secondsLeft < 900) await client.auth.refreshSession();
      } catch (_) {}
    };

    setTimeout(refreshIfNeeded, 1500);
    const timer = setInterval(refreshIfNeeded, 10 * 60 * 1000);
    window.addEventListener('pageshow', refreshIfNeeded);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshIfNeeded();
    });
    window.addEventListener('beforeunload', () => clearInterval(timer), { once:true });

    return client;
  };
})();
