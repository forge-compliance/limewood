Limewood Engineering v99900.12 NATIVE SESSION FIX

Replace these THREE files:
1. /assets/app.js
2. /index.html
3. /service-worker.js

Fixes:
- Removes the custom fallback JWT/session storage added in v99900.11.
- Uses Supabase's native persisted session and auto token refresh only.
- Refresh button now explicitly refreshes the Supabase session before cloud queries.
- Startup validates the native session before loading assets/valves.
- Exact refresh/sync errors are shown instead of leaving the status on "Connecting...".
- Keeps the v99900.11 core UI loading for assets, valves and navigation.
- Cache/version bumped to 9990012.

After deployment, fully close the app/browser, reopen it, sign in once, then watch the top-right status.
