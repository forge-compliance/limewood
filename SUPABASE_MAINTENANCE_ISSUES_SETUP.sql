-- Limewood Engineering v7.1 Maintenance Issues
-- Run once in Supabase SQL Editor.

create table if not exists public.maintenance_engineers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  trade text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_issues (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  site text not null default 'Limewood',
  reporter_name text not null,
  reporter_email text,
  reporter_phone text,
  location text not null,
  category text not null default 'General maintenance',
  priority text not null default 'Normal',
  description text not null,
  photo_url text,
  status text not null default 'New',
  source text not null default 'Public Form',
  assigned_engineer_id uuid references public.maintenance_engineers(id) on delete set null,
  engineer_notes text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.maintenance_engineers enable row level security;
alter table public.maintenance_issues enable row level security;

drop policy if exists "Authenticated users manage maintenance engineers" on public.maintenance_engineers;
create policy "Authenticated users manage maintenance engineers"
on public.maintenance_engineers for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated users manage maintenance issues" on public.maintenance_issues;
create policy "Authenticated users manage maintenance issues"
on public.maintenance_issues for all to authenticated
using (true) with check (true);

drop policy if exists "Public can submit maintenance issues" on public.maintenance_issues;
create policy "Public can submit maintenance issues"
on public.maintenance_issues for insert to anon
with check (
  source='Public Form'
  and status='New'
  and assigned_engineer_id is null
  and coalesce(reporter_name,'') <> ''
  and coalesce(location,'') <> ''
  and coalesce(description,'') <> ''
);

insert into storage.buckets (id,name,public)
values ('maintenance-issue-photos','maintenance-issue-photos',true)
on conflict (id) do nothing;

drop policy if exists "Public can upload maintenance issue photos" on storage.objects;
create policy "Public can upload maintenance issue photos"
on storage.objects for insert to anon
with check (
  bucket_id='maintenance-issue-photos'
  and (storage.foldername(name))[1]='public-maintenance'
);

drop policy if exists "Authenticated users can view maintenance issue photos" on storage.objects;
create policy "Authenticated users can view maintenance issue photos"
on storage.objects for select to authenticated
using (bucket_id='maintenance-issue-photos');

-- Add engineers after running this file, for example:
-- insert into public.maintenance_engineers(name,email,trade)
-- values ('Engineer Name','engineer@example.com','General');
