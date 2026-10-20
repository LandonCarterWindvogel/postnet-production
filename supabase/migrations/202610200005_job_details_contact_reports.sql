-- Add structured customer fulfilment details and a controlled edit RPC.
-- Existing jobs remain valid: all historical orders default to collection.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'collection',
  ADD COLUMN IF NOT EXISTS delivery_address text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_contact_name_check' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_contact_name_check
      CHECK (contact_name IS NULL OR char_length(trim(contact_name)) BETWEEN 2 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_contact_phone_check' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_contact_phone_check
      CHECK (contact_phone IS NULL OR char_length(trim(contact_phone)) BETWEEN 3 AND 40);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_fulfillment_method_check' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_fulfillment_method_check
      CHECK (fulfillment_method IN ('collection', 'delivery'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_delivery_address_check' AND conrelid = 'public.jobs'::regclass) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_delivery_address_check
      CHECK (fulfillment_method <> 'delivery' OR char_length(trim(coalesce(delivery_address, ''))) BETWEEN 5 AND 600);
  END IF;
END $$;

ALTER TABLE public.job_events DROP CONSTRAINT IF EXISTS job_events_event_type_check;
ALTER TABLE public.job_events ADD CONSTRAINT job_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created','accepted','status_change','returned','resubmitted','collected',
    'ready','rush_confirmed','priority_change','note_added','details_updated'
  ]::text[]));

CREATE OR REPLACE FUNCTION public.update_job_details(
  p_job_id uuid,
  p_customer_name text,
  p_contact_name text,
  p_contact_phone text,
  p_email_reference text,
  p_fulfillment_method text,
  p_delivery_address text,
  p_priority public.job_priority,
  p_items jsonb,
  p_notes text,
  p_cutlines_included boolean
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing_job public.jobs;
  updated_job public.jobs;
  caller_branch public.branch_name;
  item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to edit a job';
  END IF;

  SELECT * INTO existing_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  SELECT branch INTO caller_branch
  FROM public.profiles
  WHERE id = auth.uid();

  IF public.is_production() THEN
    IF existing_job.status::text NOT IN ('incoming', 'queued', 'rejected') THEN
      RAISE EXCEPTION 'A job can only be edited before production starts';
    END IF;
  ELSE
    IF caller_branch IS NULL
       OR caller_branch <> existing_job.branch
       OR existing_job.status::text NOT IN ('incoming', 'rejected') THEN
      RAISE EXCEPTION 'You can only edit your own branch jobs before production starts';
    END IF;
  END IF;

  IF p_customer_name IS NULL OR char_length(trim(p_customer_name)) < 2 OR char_length(trim(p_customer_name)) > 160 THEN
    RAISE EXCEPTION 'Enter a customer name between 2 and 160 characters';
  END IF;
  IF p_email_reference IS NULL OR char_length(trim(p_email_reference)) < 3 OR char_length(trim(p_email_reference)) > 300 THEN
    RAISE EXCEPTION 'Enter an email reference between 3 and 300 characters';
  END IF;
  IF p_contact_name IS NOT NULL AND trim(p_contact_name) <> '' AND char_length(trim(p_contact_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Contact person must be between 2 and 120 characters';
  END IF;
  IF p_contact_phone IS NOT NULL AND trim(p_contact_phone) <> '' AND char_length(trim(p_contact_phone)) NOT BETWEEN 3 AND 40 THEN
    RAISE EXCEPTION 'Contact number must be between 3 and 40 characters';
  END IF;
  IF p_fulfillment_method NOT IN ('collection', 'delivery') THEN
    RAISE EXCEPTION 'Choose collection or delivery';
  END IF;
  IF p_fulfillment_method = 'delivery'
     AND (p_delivery_address IS NULL OR char_length(trim(p_delivery_address)) NOT BETWEEN 5 AND 600) THEN
    RAISE EXCEPTION 'Enter a delivery address between 5 and 600 characters';
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'General notes cannot exceed 2000 characters';
  END IF;
  IF p_priority IS NULL THEN
    RAISE EXCEPTION 'Choose a priority';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A job must contain at least one item';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF char_length(trim(coalesce(item ->> 'name', ''))) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'Each item needs a name of 1 to 80 characters';
    END IF;
    IF char_length(coalesce(item ->> 'notes', '')) > 500 THEN
      RAISE EXCEPTION 'Item instructions cannot exceed 500 characters';
    END IF;
  END LOOP;

  UPDATE public.jobs
  SET customer_name = trim(p_customer_name),
      contact_name = nullif(trim(coalesce(p_contact_name, '')), ''),
      contact_phone = nullif(trim(coalesce(p_contact_phone, '')), ''),
      email_reference = trim(p_email_reference),
      fulfillment_method = p_fulfillment_method,
      delivery_address = CASE WHEN p_fulfillment_method = 'delivery' THEN trim(p_delivery_address) ELSE NULL END,
      priority = p_priority,
      items = p_items,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      cutlines_included = coalesce(p_cutlines_included, false),
      updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO updated_job;

  INSERT INTO public.job_events (job_id, event_type, performed_by, notes)
  VALUES (p_job_id, 'details_updated', auth.uid(), 'Job details updated');

  RETURN updated_job;
END;
$$;

REVOKE ALL ON FUNCTION public.update_job_details(uuid, text, text, text, text, text, text, public.job_priority, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_job_details(uuid, text, text, text, text, text, text, public.job_priority, jsonb, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_job_details(uuid, text, text, text, text, text, text, public.job_priority, jsonb, text, boolean) TO authenticated;
