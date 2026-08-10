-- Fix infinite recursion in staff management policies (202608020003).
-- Create a SECURITY DEFINER helper function to check if the current user is production.
-- This avoids self-referential policy recursion.

create or replace function public.is_production()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'production'
  );
end;
$$;

-- Drop the policies created in 202608020003 that cause recursion.
drop policy if exists "Production can read every profile" on public.profiles;
drop policy if exists "Production can update every profile" on public.profiles;

-- Recreate them using the helper function.
create policy "Production can read every profile"
on public.profiles for select to authenticated
using (public.is_production());

create policy "Production can update every profile"
on public.profiles for update to authenticated
using (public.is_production())
with check (public.is_production());