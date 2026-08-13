LIMEWOOD ENGINEER APP v1

WHAT IT DOES
- Uses the existing Limewood Supabase project and authentication.
- Separate mobile-first engineer interface.
- New / In progress / Waiting parts / Waiting contractor / Completed queues.
- No Accept Job button.
- Opening a job records first_viewed_at.
- Engineer must mark a job Checked before it can be completed.
- Notes and job history are retained.
- Camera/photo upload is included and uses the existing asset-files storage bucket.
- Installable as a PWA from the phone browser when hosted over HTTPS.

INSTALL
1. In Supabase > SQL Editor, run setup.sql ONCE.
2. Copy this folder into the Limewood GitHub site. Recommended path: /engineer/
3. Commit/push the files.
4. Open https://YOUR-LIMEWOOD-SITE/engineer/ on an engineer phone.
5. Sign in with an existing Limewood Supabase user.
6. Use Add to Home Screen / Install App.

TEST JOBS
At the bottom of setup.sql are 3 commented sample inserts. Remove the -- from those INSERT lines if you want test jobs.

WHATSAPP LATER
The WhatsApp webhook will insert incoming reports into public.maintenance_jobs. The Engineer app does not need to change when WhatsApp is added.

SECURITY NOTE
Version 1 allows authenticated Limewood users to view/update jobs. Once engineer accounts/roles are finalised, tighten RLS to engineer/admin roles only.
