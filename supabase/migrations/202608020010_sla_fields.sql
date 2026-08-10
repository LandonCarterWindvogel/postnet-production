-- Phase 3: SLA and rush confirmation fields

alter table public.jobs add column expected_ready_by timestamptz;
alter table public.jobs add column ready_at timestamptz;
alter table public.jobs add column collected_at timestamptz;
alter table public.jobs add column returned_at timestamptz;
alter table public.jobs add column rush_confirmed boolean default false;
alter table public.jobs add column rush_confirmed_by uuid references public.profiles(id);
alter table public.jobs add column rush_confirmed_at timestamptz;

-- Function to set expected_ready_by on insert for normal jobs (or after rush confirmation)
create or replace function public.set_expected_ready_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.priority = 'normal' then
    new.expected_ready_by := new.created_at + interval '48 hours';
  elsif new.priority in ('rush', 'urgent') then
    -- For rush/urgent, set to null until confirmed by production
    new.expected_ready_by := null;
  end if;
  return new;
end;
$$;

create trigger set_expected_ready_by_on_insert
before insert on public.jobs
for each row execute function public.set_expected_ready_by();