-- Sprint 2: a production-centre user may capture a job for any branch.
drop policy "Branch users can submit jobs for their branch" on public.jobs;

create policy "Branch users submit their jobs and production submits any job"
on public.jobs for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'production' or p.branch = jobs.branch)
  )
);
