-- Fix enum/text comparisons in the workflow trigger.
-- job status columns use the public.job_state enum, while allowed_next is text[].
-- PostgreSQL does not implicitly cast job_state to text for array_position(text[], ...),
-- so cast both status values explicitly.

create or replace function public.validate_job_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_next text[];
  current_type text;
  old_status_text text;
  new_status_text text;
begin
  -- Only validate if status is changing.
  if new.status = old.status then
    return new;
  end if;

  current_type := old.job_type;
  old_status_text := old.status::text;
  new_status_text := new.status::text;

  -- Return-for-correction must be checked before the incoming acceptance rule.
  if new_status_text = 'rejected' then
    if not public.is_production() then
      raise exception 'Only production can return a job for correction';
    end if;

    if old_status_text = 'collected' then
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
  if old_status_text = 'incoming' then
    if new_status_text != 'queued' then
      raise exception 'Incoming jobs can only be accepted (moved to queued)';
    end if;

    if new.accepted_by is null then
      new.accepted_by := auth.uid();
    end if;
    new.accepted_at := now();
    return new;
  end if;

  -- Returned jobs can only be resubmitted by Production or the owning branch.
  if old_status_text = 'rejected' and new_status_text = 'incoming' then
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
  if array_position(allowed_next, new_status_text) is null then
    raise exception 'Invalid status transition for job type %: % -> %', current_type, old_status_text, new_status_text;
  end if;

  if array_position(allowed_next, old_status_text) is null then
    raise exception 'Unexpected current status % for job type %', old_status_text, current_type;
  end if;

  if array_position(allowed_next, new_status_text) <= array_position(allowed_next, old_status_text) then
    raise exception 'Cannot move backwards in workflow (% -> %)', old_status_text, new_status_text;
  end if;

  if new_status_text = 'ready' then
    new.ready_at := now();
  end if;

  if new_status_text = 'collected' then
    new.collected_at := now();
  end if;

  return new;
end;
$$;
