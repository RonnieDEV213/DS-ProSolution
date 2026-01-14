-- ============================================================
-- Migration 022: Remove membership status gating
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Update helper functions to ignore memberships.status
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = check_user_id
      AND role = 'admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(
  check_user_id UUID,
  check_org_id UUID,
  required_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
DECLARE
  v_membership_id UUID;
BEGIN
  -- 1. Org-scoped admin bypass
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id
      AND org_id = check_org_id
      AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Get membership in this org
  SELECT id INTO v_membership_id
  FROM public.memberships
  WHERE user_id = check_user_id
    AND org_id = check_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Check RBAC permission keys
  RETURN EXISTS (
    SELECT 1
    FROM public.membership_department_roles mdr
    JOIN public.department_role_permissions drp ON drp.role_id = mdr.role_id
    JOIN public.department_roles dr ON dr.id = mdr.role_id
    WHERE mdr.membership_id = v_membership_id
      AND dr.org_id = check_org_id
      AND drp.permission_key = required_permission
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_membership_dept_role_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_membership_role TEXT;
BEGIN
  SELECT m.role
    INTO v_membership_role
  FROM public.memberships m
  WHERE m.id = NEW.membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND: Membership does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF v_membership_role <> 'va' THEN
    RAISE EXCEPTION 'NOT_VA: Department roles can only be assigned to VAs'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Update admin lockout + owner protection to ignore status
-- ============================================================

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
  affected_org := COALESCE(NEW.org_id, OLD.org_id);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(affected_org::text));

  SELECT COUNT(*) INTO remaining_count
  FROM public.memberships
  WHERE org_id = affected_org
    AND role = 'admin';

  IF remaining_count < 1 THEN
    RAISE EXCEPTION 'ADMIN_ORPHAN: Cannot remove the last admin for this organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_admin_orphan_update ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_prevent_admin_orphan_update
  AFTER UPDATE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (
    OLD.role = 'admin'
    AND NEW.role IS DISTINCT FROM OLD.role
  )
  EXECUTE FUNCTION public.check_last_admin_per_org();

DROP TRIGGER IF EXISTS trg_prevent_admin_orphan_delete ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_prevent_admin_orphan_delete
  AFTER DELETE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.check_last_admin_per_org();

CREATE OR REPLACE FUNCTION public.check_owner_membership_protected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  org_owner_id UUID;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(OLD.org_id::text || '_owner'));

  SELECT owner_user_id INTO org_owner_id
  FROM public.orgs WHERE id = OLD.org_id;

  IF OLD.user_id = org_owner_id THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'OWNER_PROTECTED: Cannot delete the organization owner membership'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.role <> 'admin' THEN
        RAISE EXCEPTION 'OWNER_PROTECTED: Cannot demote the organization owner'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_owner_membership_update ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_protect_owner_membership_update
  AFTER UPDATE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION public.check_owner_membership_protected();

DROP TRIGGER IF EXISTS trg_protect_owner_membership_delete ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_protect_owner_membership_delete
  AFTER DELETE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.check_owner_membership_protected();

-- ============================================================
-- 3. Update org RLS policy to remove status
-- ============================================================

DROP POLICY IF EXISTS "Members can view their org" ON public.orgs;
CREATE POLICY "Members can view their org" ON public.orgs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.org_id = orgs.id
      AND memberships.user_id = auth.uid()
  ));

-- ============================================================
-- 4. Drop membership status column + related constraints/indexes
-- ============================================================

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_status_check;

DROP INDEX IF EXISTS public.idx_memberships_status;
DROP INDEX IF EXISTS public.idx_memberships_user_org_status;
DROP INDEX IF EXISTS public.uq_memberships_active_user_org;

ALTER TABLE public.memberships
  DROP COLUMN IF EXISTS status;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
