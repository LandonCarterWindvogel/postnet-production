-- Replaces the hardcoded "Roland BN-20 ... Ready" placeholder that's been
-- on the board since Sprint 1/2 (labeled "Manual status for Sprint 2" in
-- the code — it never reflected anything real). Same pattern as
-- stock_items: everyone signed in can read it, only production can update
-- it, no automation — someone at the machine has to tap the status.

create type public.machine_state as enum ('ready', 'printing', 'cutting', 'maintenance');

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 60),
  status public.machine_state not null default 'ready',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.machines enable row level security;

create policy "Everyone signed in can read machines" on public.machines for select to authenticated using (true);
create policy "Production can update machines" on public.machines for update to authenticated using (public.is_production()) with check (public.is_production());

insert into public.machines (name, status) values ('Roland BN-20', 'ready');

alter publication supabase_realtime add table public.machines;
