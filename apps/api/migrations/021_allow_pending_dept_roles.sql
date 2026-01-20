-- ============================================================
-- Migration 021: Allow department roles for pending VAs
-- ============================================================
-- Purpose: Enable workflow: assign roles first, then activate
-- This fixes the chicken-and-egg loop where:
--   - VAs can't be activated without roles (frontend shows "Access Profile Required")
--   - Roles can't be assigned to inactive VAs (trigger rejects them)
-- Now allows: pending OR active VAs to receive department roles
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_membership_dept_role_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_membership_role   TEXT;
  v_membership_status TEXT;
BEGIN
  SELECT m.role, m.status
    INTO v_membership_role, v_membership_status
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

  -- Allow assigning roles only to pending/active VAs
  IF v_membership_status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'MEMBERSHIP_INACTIVE: Department roles require pending or active membership'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Verification Queries
-- ============================================================
--
-- 1. List distinct membership statuses:
--    SELECT DISTINCT status FROM public.memberships;
--
-- 2. Confirm trigger references the function:
--    SELECT tgname, proname
--    FROM pg_trigger t
--    JOIN pg_proc p ON t.tgfoid = p.oid
--    WHERE proname = 'check_membership_dept_role_valid';
-- ============================================================
