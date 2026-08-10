-- Phase 4: Job events history

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'accepted', 'status_change', 'returned', 'resubmitted', 'collected', 'ready', 'rush_confirmed', 'priority_change', 'note_added'
  )),
  from_status text,
  to_status text,
  performed_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index job_events_job_id_idx on public.job_events(job_id);
create index job_events_created_at_idx on public.job_events(created_at);

alter table public.job_events enable row level security;

-- RLS: Everyone can read events for jobs they can see (via RLS on jobs)
create policy "Users can read events for visible jobs"
on public.job_events for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_events.job_id
      and (
        public.is_production()
        or (select p.branch from public.profiles p where p.id = auth.uid()) = j.branch
      )
  )
);

-- Function to log job events automatically on status changes
create or replace function public.log_job_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_type text;
  from_status text;
  to_status text;
  notes text;
  performer uuid;
begin
  -- Determine event type based on the change
  if TG_OP = 'INSERT' then
    event_type := 'created';
    from_status := null;
    to_status := new.status;
    performer := new.created_by;
    notes := 'Job created';
  elsif TG_OP = 'UPDATE' then
    -- Only log if status changed
    if new.status <> old.status then
      -- Determine specific event type
      if new.status = 'queued' and old.status = 'incoming' then
        event_type := 'accepted';
        performer := new.accepted_by;
        notes := 'Job accepted';
      elsif new.status = 'rejected' then
        event_type := 'returned';
        performer := auth.uid();
        notes := coalesce(new.notes, 'Returned for correction');
      elsif old.status = 'rejected' and new.status = 'incoming' then
        event_type := 'resubmitted';
        performer := auth.uid();
        notes := 'Job resubmitted after correction';
      elsif new.status = 'ready' then
        event_type := 'ready';
        performer := auth.uid();
        notes := 'Marked ready for collection';
      elsif new.status = 'collected' then
        event_type := 'collected';
        performer := auth.uid();
        notes := 'Collected by customer';
      else
        event_type := 'status_change';
        performer := auth.uid();
        notes := 'Status changed';
      end if;

      from_status := old.status;
      to_status := new.status;

      insert into public.job_events (job_id, event_type, from_status, to_status, performed_by, notes)
      values (new.id, event_type, from_status, to_status, performer, notes);
    end if;

    -- Also log if notes are added (if notes changed and not already captured)
    if new.notes <> old.notes and new.notes is not null then
      insert into public.job_events (job_id, event_type, performed_by, notes)
      values (new.id, 'note_added', auth.uid(), new.notes);
    end if;

    -- If rush_confirmed changes
    if new.rush_confirmed <> old.rush_confirmed and new.rush_confirmed = true then
      insert into public.job_events (job_id, event_type, performed_by, notes)
      values (new.id, 'rush_confirmed', auth.uid(), 'Rush/Urgent confirmed by production');
    end if;
  end if;
  return new;
end;
$$;

-- Triggers on jobs
create trigger log_job_event_on_insert
after insert on public.jobs
for each row execute function public.log_job_event();

create trigger log_job_event_on_update
after update on public.jobs
for each row execute function public.log_job_event();