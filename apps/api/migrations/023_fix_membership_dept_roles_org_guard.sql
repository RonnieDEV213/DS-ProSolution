-- ============================================================
-- Migration 023: Restore dept role org guard + allow self access profiles
-- ============================================================
-- NOTE: After migration 022 drops public.memberships.status, do not re-run older
-- migrations that reference memberships.status (004, 008, 013, etc.).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Restore org match guard on dept role assignments
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_membership_dept_role_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_membership_org_id UUID;
  v_membership_role TEXT;
  v_role_org_id UUID;
BEGIN
  SELECT org_id, role
    INTO v_membership_org_id, v_membership_role
  FROM public.memberships
  WHERE id = NEW.membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND: Membership does not exist'
      USING ERRCODE = '23503';
  END IF;

  SELECT org_id
    INTO v_role_org_id
  FROM public.department_roles
  WHERE id = NEW.role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPT_ROLE: role_id not found'
      USING ERRCODE = '23514';
  END IF;

  IF v_membership_org_id <> v_role_org_id THEN
    RAISE EXCEPTION 'ORG_MISMATCH: Membership org_id does not match department role org_id'
      USING ERRCODE = '23514';
  END IF;

  IF v_membership_role <> 'va' THEN
    RAISE EXCEPTION 'NOT_VA: Department roles can only be assigned to VAs'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Allow members to view their own access profile assignments
-- ============================================================

DROP POLICY IF EXISTS "Members can view own membership dept roles" ON public.membership_department_roles;
CREATE POLICY "Members can view own membership dept roles" ON public.membership_department_roles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.id = membership_department_roles.membership_id
      AND m.user_id = auth.uid()
  ));

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
