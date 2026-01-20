-- ============================================================
-- Migration 007: Department Roles System
-- ============================================================
-- Creates department roles infrastructure for VAs that works
-- ALONGSIDE existing permissions. Does NOT modify existing
-- permission engine.
-- ============================================================

-- ============================================================
-- 1. Create Tables (idempotent)
-- ============================================================

-- Department roles (per org)
CREATE TABLE IF NOT EXISTS public.department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- Permission keys per role
CREATE TABLE IF NOT EXISTS public.department_role_permissions (
  role_id UUID NOT NULL REFERENCES public.department_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  PRIMARY KEY(role_id, permission_key)
);

-- Junction: memberships <-> department roles
CREATE TABLE IF NOT EXISTS public.membership_department_roles (
  membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.department_roles(id) ON DELETE CASCADE,
  PRIMARY KEY(membership_id, role_id)
);

-- ============================================================
-- 2. Create Indexes (idempotent)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dept_roles_org_id ON public.department_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_dept_role_perms_role_id ON public.department_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_membership_dept_roles_membership_id ON public.membership_department_roles(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_dept_roles_role_id ON public.membership_department_roles(role_id);

-- ============================================================
-- 3. DB Backstop: Forbidden permissions CHECK constraint
-- ============================================================

-- Prevent forbidden permissions from ever being stored
ALTER TABLE public.department_role_permissions
  DROP CONSTRAINT IF EXISTS chk_forbidden_permissions;

ALTER TABLE public.department_role_permissions
  ADD CONSTRAINT chk_forbidden_permissions
  CHECK (permission_key NOT IN ('payouts.read', 'profit.read'));

-- ============================================================
-- 4. DB Backstop: Org match + VA-only constraint trigger
-- ============================================================

-- Ensure membership_department_roles only links same-org + VA memberships
CREATE OR REPLACE FUNCTION public.check_membership_dept_role_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_membership_org_id UUID;
  v_membership_role TEXT;
  v_membership_status TEXT;
  v_role_org_id UUID;
BEGIN
  -- Get membership info (with NOT FOUND check)
  SELECT org_id, role, status INTO v_membership_org_id, v_membership_role, v_membership_status
  FROM public.memberships WHERE id = NEW.membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_MEMBERSHIP: membership_id not found'
      USING ERRCODE = '23514';
  END IF;

  -- Get department role org (with NOT FOUND check)
  SELECT org_id INTO v_role_org_id
  FROM public.department_roles WHERE id = NEW.role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_DEPT_ROLE: role_id not found'
      USING ERRCODE = '23514';
  END IF;

  -- Check org match
  IF v_membership_org_id <> v_role_org_id THEN
    RAISE EXCEPTION 'ORG_MISMATCH: Membership org_id does not match department role org_id'
      USING ERRCODE = '23514';
  END IF;

  -- Check VA only
  IF v_membership_role <> 'va' THEN
    RAISE EXCEPTION 'NOT_VA: Department roles can only be assigned to VA memberships'
      USING ERRCODE = '23514';
  END IF;

  -- Check active status
  IF v_membership_status <> 'active' THEN
    RAISE EXCEPTION 'NOT_ACTIVE: Department roles can only be assigned to active memberships'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_membership_dept_role ON public.membership_department_roles;
CREATE TRIGGER trg_check_membership_dept_role
  BEFORE INSERT OR UPDATE ON public.membership_department_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_membership_dept_role_valid();

-- ============================================================
-- 5. Helper function for permission lookup (for future use)
-- ============================================================

-- Helper to get all permission keys for a membership via dept roles
CREATE OR REPLACE FUNCTION public.get_membership_permission_keys(p_membership_id UUID)
RETURNS TABLE(permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT drp.permission_key
  FROM public.membership_department_roles mdr
  JOIN public.department_role_permissions drp ON drp.role_id = mdr.role_id
  WHERE mdr.membership_id = p_membership_id;
$$;

-- ============================================================
-- 6. RLS Policies (Admin-only)
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.department_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_department_roles ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is active admin in given org
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

-- ========== department_roles ==========

-- Admin SELECT
DROP POLICY IF EXISTS "Admins can view dept roles" ON public.department_roles;
CREATE POLICY "Admins can view dept roles" ON public.department_roles
  FOR SELECT
  USING (public.is_org_admin(org_id));

-- Admin INSERT
DROP POLICY IF EXISTS "Admins can manage dept roles" ON public.department_roles;
CREATE POLICY "Admins can manage dept roles" ON public.department_roles
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

-- Admin UPDATE
DROP POLICY IF EXISTS "Admins can update dept roles" ON public.department_roles;
CREATE POLICY "Admins can update dept roles" ON public.department_roles
  FOR UPDATE
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete dept roles" ON public.department_roles;
CREATE POLICY "Admins can delete dept roles" ON public.department_roles
  FOR DELETE
  USING (public.is_org_admin(org_id));

-- ========== department_role_permissions ==========

-- Admin SELECT
DROP POLICY IF EXISTS "Admins can view dept role permissions" ON public.department_role_permissions;
CREATE POLICY "Admins can view dept role permissions" ON public.department_role_permissions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.department_roles dr
    WHERE dr.id = department_role_permissions.role_id
      AND public.is_org_admin(dr.org_id)
  ));

-- Admin INSERT
DROP POLICY IF EXISTS "Admins can manage dept role permissions" ON public.department_role_permissions;
CREATE POLICY "Admins can manage dept role permissions" ON public.department_role_permissions
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.department_roles dr
    WHERE dr.id = department_role_permissions.role_id
      AND public.is_org_admin(dr.org_id)
  ));

-- Admin UPDATE
DROP POLICY IF EXISTS "Admins can update dept role permissions" ON public.department_role_permissions;
CREATE POLICY "Admins can update dept role permissions" ON public.department_role_permissions
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.department_roles dr
    WHERE dr.id = department_role_permissions.role_id
      AND public.is_org_admin(dr.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.department_roles dr
    WHERE dr.id = department_role_permissions.role_id
      AND public.is_org_admin(dr.org_id)
  ));

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete dept role permissions" ON public.department_role_permissions;
CREATE POLICY "Admins can delete dept role permissions" ON public.department_role_permissions
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.department_roles dr
    WHERE dr.id = department_role_permissions.role_id
      AND public.is_org_admin(dr.org_id)
  ));

-- ========== membership_department_roles ==========

-- Admin SELECT
DROP POLICY IF EXISTS "Admins can view membership dept roles" ON public.membership_department_roles;
CREATE POLICY "Admins can view membership dept roles" ON public.membership_department_roles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships target_m
    WHERE target_m.id = membership_department_roles.membership_id
      AND public.is_org_admin(target_m.org_id)
  ));

-- Admin INSERT
DROP POLICY IF EXISTS "Admins can manage membership dept roles" ON public.membership_department_roles;
CREATE POLICY "Admins can manage membership dept roles" ON public.membership_department_roles
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships target_m
    WHERE target_m.id = membership_department_roles.membership_id
      AND public.is_org_admin(target_m.org_id)
  ));

-- Admin UPDATE
DROP POLICY IF EXISTS "Admins can update membership dept roles" ON public.membership_department_roles;
CREATE POLICY "Admins can update membership dept roles" ON public.membership_department_roles
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships target_m
    WHERE target_m.id = membership_department_roles.membership_id
      AND public.is_org_admin(target_m.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships target_m
    WHERE target_m.id = membership_department_roles.membership_id
      AND public.is_org_admin(target_m.org_id)
  ));

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete membership dept roles" ON public.membership_department_roles;
CREATE POLICY "Admins can delete membership dept roles" ON public.membership_department_roles
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.memberships target_m
    WHERE target_m.id = membership_department_roles.membership_id
      AND public.is_org_admin(target_m.org_id)
  ));

-- ============================================================
-- 7. Seed default department roles for ALL orgs (idempotent)
-- ============================================================

-- Only seeds permissions for NEWLY inserted roles (avoids stomping custom configs)

-- 1. Insert seed roles and capture which ones were actually inserted
WITH inserted_roles AS (
  INSERT INTO public.department_roles (org_id, name, position)
  SELECT o.id, role_def.name, role_def.position
  FROM public.orgs o
  CROSS JOIN (VALUES
    ('Bookkeeping VA', 0),
    ('Order VA', 1),
    ('Returns VA', 2)
  ) AS role_def(name, position)
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id, name
)
-- 2. Seed permissions ONLY for newly inserted roles
INSERT INTO public.department_role_permissions (role_id, permission_key)
SELECT ir.id, perms.key
FROM inserted_roles ir
CROSS JOIN LATERAL (
  SELECT unnest(CASE ir.name
    WHEN 'Bookkeeping VA' THEN ARRAY['bookkeeping.read', 'bookkeeping.write', 'bookkeeping.export']
    WHEN 'Order VA' THEN ARRAY['orders.read', 'orders.write']
    WHEN 'Returns VA' THEN ARRAY['returns.read', 'returns.write']
    ELSE ARRAY[]::TEXT[]
  END) AS key
) AS perms
ON CONFLICT DO NOTHING;

-- 3. Also seed permissions for existing roles that have ZERO permissions
-- (handles case where role exists but perms were never added)
INSERT INTO public.department_role_permissions (role_id, permission_key)
SELECT dr.id, perms.key
FROM public.department_roles dr
CROSS JOIN LATERAL (
  SELECT unnest(CASE dr.name
    WHEN 'Bookkeeping VA' THEN ARRAY['bookkeeping.read', 'bookkeeping.write', 'bookkeeping.export']
    WHEN 'Order VA' THEN ARRAY['orders.read', 'orders.write']
    WHEN 'Returns VA' THEN ARRAY['returns.read', 'returns.write']
    ELSE ARRAY[]::TEXT[]
  END) AS key
) AS perms
WHERE dr.name IN ('Bookkeeping VA', 'Order VA', 'Returns VA')
  AND NOT EXISTS (
    SELECT 1 FROM public.department_role_permissions drp WHERE drp.role_id = dr.id
  )
ON CONFLICT DO NOTHING;
