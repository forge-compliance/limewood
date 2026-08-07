-- Limewood Engineering v6.5
-- Public Main Pool Water Test
-- Run ONCE in Supabase SQL Editor after the v6.4 log_entries table setup.

alter table public.log_entries enable row level security;

drop policy if exists "Public can submit pool water tests" on public.log_entries;

create policy "Public can submit pool water tests"
on public.log_entries
for insert
to anon
with check (
  log_type = 'pool_water'
  and logged_by is null
  and location = 'Main Pool'
  and client_id like 'public-pool-%'
  and coalesce(payload->>'operator_name','') <> ''
);

-- No anon SELECT, UPDATE or DELETE policy is created.
-- Public visitors can submit a record, but cannot browse or change records.
