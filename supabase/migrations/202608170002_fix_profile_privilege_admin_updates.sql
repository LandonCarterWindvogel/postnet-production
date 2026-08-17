-- Preserve the profile self-privilege-escalation protection while allowing
-- administrative SQL sessions (where auth.uid() is NULL) to perform explicit
-- staff role/branch maintenance.
--
-- Normal authenticated users still cannot change their own role or branch.
-- Production users can manage staff through the existing production-only RLS
-- policy. The SQL Editor/admin path is only available outside an authenticated
-- user session, so a branch user cannot trigger this bypass from the browser.

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Supabase SQL Editor/admin sessions do not have an authenticated user id.
  -- Allow explicit administrative maintenance without weakening browser users.
  if auth.uid() is null then
    return new;
  end if;

  -- Production users are allowed to manage staff roles/branches.
  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'production'
  ) then
    return new;
  end if;

  -- All other authenticated users are prevented from changing their own
  -- privilege level or branch. Other profile fields may still be updated.
  new.role := old.role;
  new.branch := old.branch;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_privilege_escalation on public.profiles;

create trigger profiles_prevent_self_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_self_privilege_escalation();
