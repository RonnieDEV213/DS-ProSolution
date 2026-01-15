-- ============================================================
-- DS-ProSolution: Admin Lockout Prevention
-- Prevents orphaning the last active admin per organization
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- Function to check if at least one active admin remains per org
-- This runs AFTER the UPDATE/DELETE has been applied, so we count the new state
CREATE OR REPLACE FUNCTION public.check_last_admin_per_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  remaining_count INTEGER;
  affected_org UUID;
BEGIN
  -- Determine which org to check (NEW is NULL for DELETE, so COALESCE handles both)
  affected_org := COALESCE(NEW.org_id, OLD.org_id);

  -- Serialize concurrent admin-demotion/deactivation operations per org
  -- This prevents race conditions where two concurrent operations both pass the check
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(affected_org::text));

  SELECT COUNT(*) INTO remaining_count
  FROM public.memberships
  WHERE org_id = affected_org
    AND role = 'admin'
    AND status = 'active';

  IF remaining_count < 1 THEN
    RAISE EXCEPTION 'ADMIN_ORPHAN: Cannot remove or deactivate the last active admin for this organization'
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$function$;

-- Trigger 1: AFTER UPDATE - fires only when an active admin's role OR status changes
DROP TRIGGER IF EXISTS trg_prevent_admin_orphan_update ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_prevent_admin_orphan_update
  AFTER UPDATE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (
    OLD.role = 'admin' AND OLD.status = 'active'
    AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status)
  )
  EXECUTE FUNCTION public.check_last_admin_per_org();

-- Trigger 2: AFTER DELETE - fires only when deleting an active admin
DROP TRIGGER IF EXISTS trg_prevent_admin_orphan_delete ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_prevent_admin_orphan_delete
  AFTER DELETE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND OLD.status = 'active')
  EXECUTE FUNCTION public.check_last_admin_per_org();
