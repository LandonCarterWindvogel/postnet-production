-- PostNet Production v0.1.0 foundation. Apply through Supabase CLI or SQL Editor.
create extension if not exists "pgcrypto";

create type public.branch_name as enum ('Plettenberg Bay', 'Knysna', 'Waterside', 'Sedgefield');
create type public.user_role as enum ('production', 'branch_admin', 'branch_user');
create type public.job_type as enum ('stickers', 'flex');
create type public.job_priority as enum ('standard', 'rush', 'urgent');
create type public.job_state as enum ('incoming', 'queued', 'printing', 'drying', 'contour_cutting', 'weeding', 'heat_press', 'quality_check', 'ready', 'collected', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  branch public.branch_name not null,
  role public.user_role not null default 'branch_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_number bigint generated always as identity unique,
  branch public.branch_name not null,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 160),
  email_reference text not null check (char_length(trim(email_reference)) between 3 and 300),
  job_type public.job_type not null,
  material text not null check (char_length(trim(material)) between 2 and 80),
  specification text not null check (char_length(trim(specification)) between 2 and 240),
  quantity integer not null check (quantity > 0),
  priority public.job_priority not null default 'standard',
  status public.job_state not null default 'incoming',
  cutlines_included boolean not null default false,
  artwork_checklist_complete boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A new Supabase Auth user becomes a branch user automatically. An administrator
-- can change their branch and role in the SQL Editor before they start work.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, branch, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'branch')::public.branch_name, 'Plettenberg Bay'),
    'branch_user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create index jobs_status_created_at_idx on public.jobs (status, created_at);
create index jobs_branch_created_at_idx on public.jobs (branch, created_at desc);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

create policy "Users can read their own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can read jobs from their branch or production" on public.jobs for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'production' or p.branch = jobs.branch))
);
create policy "Branch users can submit jobs for their branch" on public.jobs for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.branch = jobs.branch)
);
create policy "Production can manage every job" on public.jobs for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production')
);
