-- Fix rejection transition ordering.
-- Production must be able to return an incoming job for correction.
-- The previous trigger handled incoming -> queued before checking incoming -> rejected,
-- so every rejection from Incoming failed with "Incoming jobs can only be accepted".

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
  -- Only validate if status is changing.
  if new.status = old.status then
    return new;
  end if;

  current_type := old.job_type;

  -- Return-for-correction must be checked BEFORE the incoming acceptance rule.
  -- Production may return any active job except an already collected job.
  if new.status = 'rejected' then
    if not public.is_production() then
      raise exception 'Only production can return a job for correction';
    end if;

    if old.status = 'collected' then
      raise exception 'Cannot return a collected job';
    end if;

    new.returned_at := now();
    return new;
  end if;

  -- Define allowed forward transitions based on job type.
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

  -- Incoming jobs can only be accepted into the production queue.
  if old.status = 'incoming' then
    if new.status != 'queued' then
      raise exception 'Incoming jobs can only be accepted (moved to queued)';
    end if;

    if new.accepted_by is null then
      new.accepted_by := auth.uid();
    end if;
    new.accepted_at := now();
    return new;
  end if;

  -- Returned jobs can only be resubmitted by Production or the owning branch.
  if old.status = 'rejected' and new.status = 'incoming' then
    if not (
      public.is_production()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.branch = old.branch
      )
    ) then
      raise exception 'Only the owning branch or production can resubmit a corrected job';
    end if;

    new.accepted_by := null;
    new.accepted_at := null;
    new.returned_at := null;
    return new;
  end if;

  -- All other changes must follow the job-type workflow in order.
  if array_position(allowed_next, new.status) is null then
    raise exception 'Invalid status transition for job type %: % -> %', current_type, old.status, new.status;
  end if;

  if array_position(allowed_next, old.status) is null then
    raise exception 'Unexpected current status % for job type %', old.status, current_type;
  end if;

  if array_position(allowed_next, new.status) <= array_position(allowed_next, old.status) then
    raise exception 'Cannot move backwards in workflow (% -> %)', old.status, new.status;
  end if;

  if new.status = 'ready' then
    new.ready_at := now();
  end if;

  if new.status = 'collected' then
    new.collected_at := now();
  end if;

  return new;
end;
$$;
