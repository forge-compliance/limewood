-- Lake House plant room setup
-- Safe to run once Supabase connector access is restored.
-- Creates the building if required, creates Lake House Plant Room if required,
-- and leaves uploaded asset/photo assignment to the live matching pass.

begin;

insert into public.buildings (name)
select 'Lake House'
where not exists (
  select 1 from public.buildings where lower(name)=lower('Lake House')
);

insert into public.plant_rooms (name, building_id)
select
  'Lake House Plant Room',
  b.id
from public.buildings b
where lower(b.name)=lower('Lake House')
  and not exists (
    select 1 from public.plant_rooms pr
    where lower(pr.name)=lower('Lake House Plant Room')
  );

commit;

-- Verification
select pr.id, pr.name, b.name as building
from public.plant_rooms pr
left join public.buildings b on b.id=pr.building_id
where lower(pr.name)=lower('Lake House Plant Room');
