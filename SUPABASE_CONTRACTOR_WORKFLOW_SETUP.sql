-- Limewood Engineering v7.2 Contractor & Quotation Management
-- Run once in Supabase SQL Editor AFTER the v7.1 maintenance setup.

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  name text,
  email text not null,
  phone text,
  trade text,
  approved boolean not null default false,
  active boolean not null default true,
  insurance_expiry date,
  accreditation_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contractor_quotes (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  issue_id uuid not null references public.maintenance_issues(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete restrict,
  secure_token text unique not null,
  status text not null default 'Requested',
  proposal_type text,
  proposal_scope text,
  exclusions text,
  quoted_amount numeric(12,2),
  approved_amount numeric(12,2),
  contractor_quote_ref text,
  lead_time text,
  warranty text,
  earliest_attendance date,
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  instructed_at timestamptz,
  booked_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(issue_id,contractor_id)
);

alter table public.contractors enable row level security;
alter table public.contractor_quotes enable row level security;

drop policy if exists "Authenticated manage contractors" on public.contractors;
create policy "Authenticated manage contractors" on public.contractors for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated manage contractor quotes" on public.contractor_quotes;
create policy "Authenticated manage contractor quotes" on public.contractor_quotes for all to authenticated using (true) with check (true);

-- No anonymous policies are created.
-- Contractor quote links use Cloudflare Pages Functions with the server-side service role key.
