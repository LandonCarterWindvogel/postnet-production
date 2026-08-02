-- Sprint 4: enable Realtime change notifications for the jobs table so the
-- Production Board and My Jobs update live across branches without a manual
-- refresh. Existing RLS select policies on public.jobs still govern which
-- rows each connected client actually receives.
alter publication supabase_realtime add table public.jobs;
