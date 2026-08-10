-- Phase 2: Workflow enforcement, material compatibility, branch resubmission

-- Add accepted_at column
alter table public.jobs add column accepted_at timestamptz;

-- Function to validate status transitions
create or replace function public.validate_job_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_next text[];
  current_type text;
begin
  -- Only validate if status is changing
  if new.status = old.status then
    return new;
  end if;

  -- Get job type
  current_type := old.job_type;

  -- Define allowed transitions based on job type
  if current_type = 'stickers' then
    allowed_next := array[
      'queued', 'printing', 'drying', 'contour_cutting', 'weeding', 'quality_check', 'ready', 'collected'
    ];
  elsif current_type = 'flex' then
    allowed_next := array[
      'queued', 'cutting', 'weeding', 'heat_press', 'quality_check', 'ready', 'collected'
    ];
  else
    raise exception 'Unknown job type %', current_type;
  end if;

  -- If moving from incoming, only queued is allowed (accept)
  if old.status = 'incoming' then
    if new.status != 'queued' then
      raise exception 'Incoming jobs can only be accepted (moved to queued)';
    end if;
    -- Set accepted_by and accepted_at (if not already set)
    if new.accepted_by is null then
      new.accepted_by := auth.uid();
    end if;
    new.accepted_at := now();
    return new;
  end if;

  -- If moving to rejected (return for correction), any active status is allowed
  if new.status = 'rejected' then
    -- Only production can reject
    if not public.is_production() then
      raise exception 'Only production can return a job for correction';
    end if;
    -- Allow any previous status except collected (already closed)
    if old.status = 'collected' then
      raise exception 'Cannot return a collected job';
    end if;
    -- Set returned_at
    new.returned_at := now();
    return new;
  end if;

  -- If moving from rejected to incoming (resubmit), allow only for the branch that owns the job
  if old.status = 'rejected' and new.status = 'incoming' then
    -- Check if the current user is the branch user or production
    if not (public.is_production() or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.branch = old.branch
    )) then
      raise exception 'Only the owning branch or production can resubmit a corrected job';
    end if;
    -- Clear accepted_by and accepted_at; reset notes? We keep notes for history.
    new.accepted_by := null;
    new.accepted_at := null;
    new.returned_at := null; -- Not needed anymore
    return new;
  end if;

  -- For other transitions, check if the new status is in the allowed next steps
  -- but only if moving forward in the workflow (not skipping)
  if array_position(allowed_next, new.status) is null then
    raise exception 'Invalid status transition for job type %: % -> %', current_type, old.status, new.status;
  end if;

  -- Ensure the new status appears after the current status in the allowed list
  if array_position(allowed_next, old.status) is null then
    -- If old status is not in the list (e.g., incoming or rejected), we already handled above
    raise exception 'Unexpected current status % for job type %', old.status, current_type;
  end if;

  if array_position(allowed_next, new.status) <= array_position(allowed_next, old.status) then
    raise exception 'Cannot move backwards in workflow (% -> %)', old.status, new.status;
  end if;

  -- If moving to ready, set ready_at
  if new.status = 'ready' then
    new.ready_at := now();
  end if;

  -- If moving to collected, set collected_at
  if new.status = 'collected' then
    new.collected_at := now();
  end if;

  return new;
end;
$$;

-- Create trigger
create trigger enforce_job_status_transition
before update on public.jobs
for each row execute function public.validate_job_status_transition();

-- Function to enforce material/job_type compatibility on insert/update
create or replace function public.validate_job_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.stock_items
    where material = new.material
      and category = (
        case new.job_type
          when 'stickers' then 'stickers'::public.stock_category
          when 'flex' then 'flex'::public.stock_category
        end
      )
  ) then
    raise exception 'Material "%" is not valid for job type "%"', new.material, new.job_type;
  end if;
  return new;
end;
$$;

create trigger enforce_job_material_compatibility
before insert or update on public.jobs
for each row execute function public.validate_job_material();

-- Update RLS to allow branch users to resubmit (update) their rejected jobs
-- First, drop the existing update policy (production only)
drop policy if exists "Production can manage every job" on public.jobs;

-- Create a new policy that allows production to update any job, and branch users to update only their own rejected jobs (to incoming)
create policy "Production can manage every job and branches can resubmit"
on public.jobs for update to authenticated
using (
  public.is_production()
  or (
    -- Branch user can update their own job if it's rejected and they are changing it to incoming
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.branch = jobs.branch
        and jobs.status = 'rejected'
        and new.status = 'incoming'  -- requires the new status to be incoming (checked in trigger)
    )
  )
)
with check (
  public.is_production()
  or (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.branch = jobs.branch
        and jobs.status = 'rejected'
        and new.status = 'incoming'
    )
  )
);