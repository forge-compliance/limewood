-- Optional v5.2 shared-cloud tables. Run in Supabase SQL editor when ready.
create table if not exists public.ppm_schedules (id uuid primary key default gen_random_uuid(), asset_code text unique not null, frequency text, last_completed date, next_due date, assigned_to text, completion_status text default 'Scheduled', task text, notes text, created_at timestamptz default now(), updated_at timestamptz default now(), updated_by uuid);
create table if not exists public.valve_register (id uuid primary key default gen_random_uuid(), tag text unique not null, plant_room text, asset_code text, service_duty text, valve_type text, size text, normal_position text, location text, isolation_purpose text, last_verified date, notes text, created_at timestamptz default now(), updated_at timestamptz default now(), updated_by uuid);
alter table public.ppm_schedules enable row level security; alter table public.valve_register enable row level security;
create policy "authenticated ppm access" on public.ppm_schedules for all to authenticated using (true) with check (true);
create policy "authenticated valve access" on public.valve_register for all to authenticated using (true) with check (true);
