-- Separate owner settings access from the production-centre workflow.
-- Production operators keep cross-branch job, stock and machine permissions.
-- Only system_admin profiles can manage staff profiles and role assignments.

CREATE OR REPLACE FUNCTION public.is_production()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN (
        'production'::public.user_role,
        'system_admin'::public.user_role
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'system_admin'::public.user_role
  );
$$;

-- Keep privileged helper functions from becoming arbitrary public RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.is_production() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_production() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_system_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- These functions are invoked by database triggers, not directly from the app.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_job_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_expected_ready_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_job_material() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_job_status_transition() FROM PUBLIC, anon, authenticated;

-- A production operator cannot browse or edit all staff profiles.
DROP POLICY IF EXISTS "Production can read every profile" ON public.profiles;
DROP POLICY IF EXISTS "Production can update every profile" ON public.profiles;

CREATE POLICY "System admins can read every profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT public.is_system_admin()));

CREATE POLICY "System admins can update every profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT public.is_system_admin()))
WITH CHECK ((SELECT public.is_system_admin()));

-- Keep system admins fully capable of doing production work.
DROP POLICY IF EXISTS "Users can read jobs from their branch or production" ON public.jobs;
CREATE POLICY "Users can read jobs from their branch or production"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_production())
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.branch = jobs.branch
  )
);

DROP POLICY IF EXISTS "Branch users submit their jobs and production submits any job" ON public.jobs;
CREATE POLICY "Branch users submit their jobs and production submits any job"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'incoming'::public.job_state
  AND accepted_by IS NULL
  AND (
    (SELECT public.is_production())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.branch = jobs.branch
    )
  )
);

DROP POLICY IF EXISTS "Production can manage stock" ON public.stock_items;
CREATE POLICY "Production can manage stock"
ON public.stock_items
FOR UPDATE
TO authenticated
USING ((SELECT public.is_production()))
WITH CHECK ((SELECT public.is_production()));

-- Prevent staff and production operators from promoting themselves or changing
-- their own branch. Even the owner account cannot accidentally demote itself.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SQL Editor/admin sessions without an authenticated user remain an
  -- administrative recovery path.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'system_admin'::public.user_role
  ) THEN
    IF OLD.id = (SELECT auth.uid())
       AND OLD.role = 'system_admin'::public.user_role THEN
      NEW.role := OLD.role;
      NEW.branch := OLD.branch;
    END IF;

    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.branch := OLD.branch;
  RETURN NEW;
END;
$$;
