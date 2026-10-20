-- Allow one job to contain multiple sticker and T-shirt Flex items.
-- Existing jobs keep items = NULL and continue using the legacy summary fields.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS items jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_items_array_check'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_items_array_check
      CHECK (items IS NULL OR jsonb_typeof(items) = 'array');
  END IF;
END;
$$;

-- Validate every line item against the material stock catalogue, then derive
-- the legacy summary columns so old board/reporting code remains compatible.
CREATE OR REPLACE FUNCTION public.validate_job_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  first_item jsonb;
  item_type text;
  item_material text;
  item_category public.stock_category;
  sticker_count integer := 0;
  flex_count integer := 0;
  total_quantity bigint := 0;
  expected_type text;
BEGIN
  IF NEW.items IS NULL OR NEW.items = '[]'::jsonb THEN
    IF NEW.job_type::text = 'mixed' THEN
      RAISE EXCEPTION 'Mixed jobs must include at least one sticker or T-shirt Flex item';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.stock_items
      WHERE material = NEW.material
        AND category = CASE NEW.job_type::text
          WHEN 'stickers' THEN 'stickers'::public.stock_category
          WHEN 'flex' THEN 'flex'::public.stock_category
        END
    ) THEN
      RAISE EXCEPTION 'Material "%" is not valid for job type "%"', NEW.material, NEW.job_type;
    END IF;

    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'A job must contain at least one item';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.items) AS value
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'Each job item must be an object';
    END IF;

    item_type := COALESCE(item ->> 'type', '');
    item_material := COALESCE(item ->> 'material', '');

    IF item_type NOT IN ('stickers', 'flex') THEN
      RAISE EXCEPTION 'Unsupported item type "%"', item_type;
    END IF;

    IF COALESCE(item ->> 'width_mm', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR COALESCE(item ->> 'height_mm', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR COALESCE(item ->> 'quantity', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Each item needs numeric width, height and quantity';
    END IF;

    IF (item ->> 'width_mm')::numeric <= 0
       OR (item ->> 'height_mm')::numeric <= 0
       OR (item ->> 'quantity')::bigint <= 0 THEN
      RAISE EXCEPTION 'Item sizes and quantity must be greater than zero';
    END IF;

    item_category := CASE item_type
      WHEN 'stickers' THEN 'stickers'::public.stock_category
      WHEN 'flex' THEN 'flex'::public.stock_category
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.stock_items
      WHERE material = item_material AND category = item_category
    ) THEN
      RAISE EXCEPTION 'Material "%" is not valid for item type "%"', item_material, item_type;
    END IF;

    IF item_type = 'stickers' THEN
      sticker_count := sticker_count + 1;
    ELSE
      flex_count := flex_count + 1;
    END IF;

    total_quantity := total_quantity + (item ->> 'quantity')::bigint;
  END LOOP;

  IF total_quantity > 2147483647 THEN
    RAISE EXCEPTION 'Total item quantity exceeds the supported limit';
  END IF;

  first_item := NEW.items -> 0;
  expected_type := CASE
    WHEN sticker_count > 0 AND flex_count > 0 THEN 'mixed'
    WHEN sticker_count > 0 THEN 'stickers'
    ELSE 'flex'
  END;

  NEW.job_type := expected_type::public.job_type;
  NEW.material := first_item ->> 'material';
  NEW.specification := concat(first_item ->> 'width_mm', ' × ', first_item ->> 'height_mm', ' mm');
  NEW.quantity := total_quantity::integer;

  RETURN NEW;
END;
$$;

-- Mixed jobs use both production paths in one tracked job:
-- print/dry/cut stickers, cut/weeding/press flex, then quality check.
CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_next text[];
  current_type text;
  old_status_text text;
  new_status_text text;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  current_type := old.job_type::text;
  old_status_text := old.status::text;
  new_status_text := new.status::text;

  IF new_status_text = 'rejected' THEN
    IF NOT public.is_production() THEN
      RAISE EXCEPTION 'Only production can return a job for correction';
    END IF;
    IF old_status_text = 'collected' THEN
      RAISE EXCEPTION 'Cannot return a collected job';
    END IF;
    new.returned_at := now();
    RETURN new;
  END IF;

  IF current_type = 'stickers' THEN
    allowed_next := ARRAY[
      'queued', 'printing', 'drying', 'contour_cutting', 'weeding', 'quality_check', 'ready', 'collected'
    ];
  ELSIF current_type = 'flex' THEN
    allowed_next := ARRAY[
      'queued', 'cutting', 'weeding', 'heat_press', 'quality_check', 'ready', 'collected'
    ];
  ELSIF current_type = 'mixed' THEN
    allowed_next := ARRAY[
      'queued', 'printing', 'drying', 'contour_cutting', 'cutting', 'weeding', 'heat_press', 'quality_check', 'ready', 'collected'
    ];
  ELSE
    RAISE EXCEPTION 'Unknown job type %', current_type;
  END IF;

  IF old_status_text = 'incoming' THEN
    IF new_status_text != 'queued' THEN
      RAISE EXCEPTION 'Incoming jobs can only be accepted (moved to queued)';
    END IF;
    IF new.accepted_by IS NULL THEN
      new.accepted_by := auth.uid();
    END IF;
    new.accepted_at := now();
    RETURN new;
  END IF;

  IF old_status_text = 'rejected' AND new_status_text = 'incoming' THEN
    IF NOT (
      public.is_production()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.branch = old.branch
      )
    ) THEN
      RAISE EXCEPTION 'Only the owning branch or production can resubmit a corrected job';
    END IF;
    new.accepted_by := NULL;
    new.accepted_at := NULL;
    new.returned_at := NULL;
    RETURN new;
  END IF;

  IF array_position(allowed_next, new_status_text) IS NULL THEN
    RAISE EXCEPTION 'Invalid status transition for job type %: % -> %', current_type, old_status_text, new_status_text;
  END IF;
  IF array_position(allowed_next, old_status_text) IS NULL THEN
    RAISE EXCEPTION 'Unexpected current status % for job type %', old_status_text, current_type;
  END IF;
  IF array_position(allowed_next, new_status_text) <= array_position(allowed_next, old_status_text) THEN
    RAISE EXCEPTION 'Cannot move backwards in workflow (% -> %)', old_status_text, new_status_text;
  END IF;

  IF new_status_text = 'ready' THEN new.ready_at := now(); END IF;
  IF new_status_text = 'collected' THEN new.collected_at := now(); END IF;

  RETURN new;
END;
$$;
