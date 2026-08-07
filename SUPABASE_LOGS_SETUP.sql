-- Limewood Engineering v6.4 Logs & Checks
-- Run once in Supabase SQL Editor.
create table if not exists public.log_entries (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  log_type text not null,
  location text,
  plant_room text,
  logged_at timestamptz not null default now(),
  logged_by uuid references auth.users(id) on delete set null,
  logged_by_email text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'Logged',
  created_at timestamptz not null default now()
);

create index if not exists log_entries_logged_at_idx on public.log_entries(logged_at desc);
create index if not exists log_entries_log_type_idx on public.log_entries(log_type);
create index if not exists log_entries_plant_room_idx on public.log_entries(plant_room);

alter table public.log_entries enable row level security;

drop policy if exists "Authenticated users can read logs" on public.log_entries;
create policy "Authenticated users can read logs"
on public.log_entries for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create logs" on public.log_entries;
create policy "Authenticated users can create logs"
on public.log_entries for insert
to authenticated
with check (auth.uid() = logged_by);

drop policy if exists "Authenticated users can update their logs" on public.log_entries;
create policy "Authenticated users can update their logs"
on public.log_entries for update
to authenticated
using (auth.uid() = logged_by)
with check (auth.uid() = logged_by);
