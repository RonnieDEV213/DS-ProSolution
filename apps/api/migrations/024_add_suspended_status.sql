-- ============================================================
-- Migration 024: Add suspended status to memberships
-- ============================================================
-- Purpose: Enable user suspension feature
-- Idempotent: Safe to run multiple times
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Add status column if not exists
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.memberships ADD COLUMN status TEXT;
  END IF;
END $$;

-- ============================================================
-- 2. Backfill: NULL -> 'active', legacy 'disabled' -> 'suspended'
-- ============================================================

UPDATE public.memberships
SET status = 'active'
WHERE status IS NULL;

UPDATE public.memberships
SET status = 'suspended'
WHERE status = 'disabled';

-- Map any other unexpected values to 'active'
UPDATE public.memberships
SET status = 'active'
WHERE status NOT IN ('active', 'suspended');

-- ============================================================
-- 3. Add NOT NULL constraint (safe now that all values are set)
-- ============================================================

ALTER TABLE public.memberships
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.memberships
  ALTER COLUMN status SET DEFAULT 'active';

-- ============================================================
-- 4. Add named CHECK constraint
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'memberships_status_check'
      AND table_name = 'memberships'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_status_check
      CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;

-- ============================================================
-- 5. Create index for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_memberships_status
  ON public.memberships(status);

-- ============================================================
-- 6. Update RLS policies to require status='active'
-- ============================================================

-- Update org visibility policy
DROP POLICY IF EXISTS "Members can view their org" ON public.orgs;
CREATE POLICY "Members can view their org" ON public.orgs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.org_id = orgs.id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
  ));

-- Update accounts policy (if exists)
DROP POLICY IF EXISTS "Users can view assigned accounts" ON public.accounts;
CREATE POLICY "Users can view assigned accounts" ON public.accounts FOR SELECT
  USING (
    -- Admins can see all accounts
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
        AND memberships.status = 'active'
    )
    OR
    -- VAs can see assigned accounts
    EXISTS (
      SELECT 1 FROM public.account_assignments aa
      JOIN public.memberships m ON m.user_id = aa.user_id
      WHERE aa.account_id = accounts.id
        AND aa.user_id = auth.uid()
        AND m.status = 'active'
    )
    OR
    -- Clients can see their own accounts
    (
      accounts.client_user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.memberships
        WHERE memberships.user_id = auth.uid()
          AND memberships.status = 'active'
      )
    )
  );

-- Update bookkeeping_records policy (if exists)
DROP POLICY IF EXISTS "Users can view records for assigned accounts" ON public.bookkeeping_records;
CREATE POLICY "Users can view records for assigned accounts" ON public.bookkeeping_records FOR SELECT
  USING (
    -- Admins can see all records
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
        AND memberships.status = 'active'
    )
    OR
    -- VAs can see records for assigned accounts
    EXISTS (
      SELECT 1 FROM public.account_assignments aa
      JOIN public.memberships m ON m.user_id = aa.user_id
      WHERE aa.account_id = bookkeeping_records.account_id
        AND aa.user_id = auth.uid()
        AND m.status = 'active'
    )
    OR
    -- Clients can see records for their accounts
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.memberships m ON m.user_id = a.client_user_id
      WHERE a.id = bookkeeping_records.account_id
        AND a.client_user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Update invites policy (admin only)
DROP POLICY IF EXISTS "Admins can view invites" ON public.invites;
CREATE POLICY "Admins can view invites" ON public.invites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
      AND memberships.status = 'active'
  ));

DROP POLICY IF EXISTS "Admins can insert invites" ON public.invites;
CREATE POLICY "Admins can insert invites" ON public.invites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
      AND memberships.status = 'active'
  ));

DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;
CREATE POLICY "Admins can update invites" ON public.invites FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
      AND memberships.status = 'active'
  ));

-- ============================================================
-- 7. Update helper functions to check status='active'
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
      AND status = 'active'
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
      AND status = 'active'
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
  v_membership_status TEXT;
BEGIN
  -- 1. Org-scoped admin bypass (must be active)
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id
      AND org_id = check_org_id
      AND role = 'admin'
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Get membership in this org (must be active)
  SELECT id, status INTO v_membership_id, v_membership_status
  FROM public.memberships
  WHERE user_id = check_user_id
    AND org_id = check_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Suspended users have no permissions
  IF v_membership_status <> 'active' THEN
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

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verification Queries
-- ============================================================
--
-- 1. Check status column exists:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'memberships' AND column_name = 'status';
--
-- 2. Check constraint exists:
--    SELECT constraint_name FROM information_schema.table_constraints
--    WHERE table_name = 'memberships' AND constraint_name = 'memberships_status_check';
--
-- 3. Check all memberships have valid status:
--    SELECT DISTINCT status FROM public.memberships;
--
-- ============================================================
