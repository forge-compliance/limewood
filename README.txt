Limewood Engineering v99900.11 SESSION + CORE UI FIX

Replace:
1. /assets/app.js
2. /index.html
3. /service-worker.js

Fixes:
- Stores a fallback copy of the authenticated Supabase session locally.
- On refresh, tries Supabase getSession first, then restores the saved session.
- Clears the fallback only on real sign-out or failed restore.
- Loads assets and Operations (valves/PPM) as core startup data.
- Explicitly refreshes plant-room navigation, asset filters, stats, valves and dashboard.
- Documents and logs load in the background.
- Version/cache bumped to 9990011.
