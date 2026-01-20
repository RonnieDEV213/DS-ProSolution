-- ============================================================
-- Migration 016: has_permission() function for RBAC SSoT
-- ============================================================
-- Purpose: Org-scoped permission check using RBAC tables
-- This function will eventually replace is_order_dept/is_service_dept
-- ============================================================

-- 1. Uniqueness guard: prevent multiple active memberships per (user_id, org_id)
--    This ensures deterministic behavior in has_permission()
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_active_user_org
  ON public.memberships (user_id, org_id)
  WHERE status = 'active';

-- 2. Create the has_permission function
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
  --    Admins in this org have all permissions
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id
      AND org_id = check_org_id
      AND role = 'admin'
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Get active membership in this specific org
  --    ORDER BY created_at DESC ensures deterministic result if constraint is violated
  SELECT id INTO v_membership_id
  FROM public.memberships
  WHERE user_id = check_user_id
    AND org_id = check_org_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- No active membership in this org = no permission
  IF v_membership_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Check RBAC permission keys
  --    Join through department_roles to ensure org match
  RETURN EXISTS (
    SELECT 1
    FROM public.membership_department_roles mdr
    JOIN public.department_role_permissions drp ON drp.role_id = mdr.role_id
    JOIN public.department_roles dr ON dr.id = mdr.role_id
    WHERE mdr.membership_id = v_membership_id
      AND dr.org_id = check_org_id  -- Ensure role belongs to same org
      AND drp.permission_key = required_permission
  );
END;
$$;

-- 3. Performance indexes

-- Index for membership lookup (user_id, org_id, status)
CREATE INDEX IF NOT EXISTS idx_memberships_user_org_status
  ON public.memberships (user_id, org_id, status);

-- Composite index for membership_department_roles join efficiency
CREATE INDEX IF NOT EXISTS idx_mdr_membership_role
  ON public.membership_department_roles (membership_id, role_id);

-- Index for department_role_permissions lookup (role_id, permission_key)
CREATE INDEX IF NOT EXISTS idx_drp_role_permission
  ON public.department_role_permissions (role_id, permission_key);

-- Index for department_roles org lookup
CREATE INDEX IF NOT EXISTS idx_dr_org_id
  ON public.department_roles (org_id);

-- 4. Grant execute to authenticated users (needed for RLS)
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, UUID, TEXT) TO authenticated;
