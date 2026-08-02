-- Sprint 7 QA pass. Two gaps found by reviewing every policy end to end —
-- neither is exploitable through the app's own UI, but RLS is the actual
-- security boundary (any authenticated client can call the Supabase API
-- directly), so both are closed here rather than left as "the UI won't do
-- that".

-- 1. "Users can update their own profile" (Sprint 1) has no column
-- restriction — a branch_user could call the API directly and set their
-- own role to 'production'. A trigger is used instead of tightening the
-- policy, so a single self-update request can still change full_name
-- while role/branch silently stay put for non-production callers.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'production') then
    return new;
  end if;

  new.role := old.role;
  new.branch := old.branch;
  return new;
end;
$$;

create trigger profiles_prevent_self_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_self_privilege_escalation();

-- 2. The job insert policy (Sprint 2) checks who's creating the job and
-- which branch it's for, but never checks what status or accepted_by it's
-- created with — a client could insert a job as already 'ready' or
-- 'collected', skipping the workflow entirely. Replace the policy with one
-- that also requires a fresh job to start at 'incoming' with no acceptor.
drop policy "Branch users submit their jobs and production submits any job" on public.jobs;

create policy "Branch users submit their jobs and production submits any job"
on public.jobs for insert to authenticated with check (
  created_by = auth.uid()
  and status = 'incoming'
  and accepted_by is null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'production' or p.branch = jobs.branch)
  )
);
