-- ============================================================
-- DS-ProSolution: User Management Foundation (Phase 1)
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ALTER memberships TABLE - Add access gating fields
-- ============================================================

-- Add status column (pending/active/disabled)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Patch is_admin() to require active membership (prevents disabled admins from passing admin checks)
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

-- Add constraint for status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_status_check'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_status_check
      CHECK (status IN ('pending', 'active', 'disabled'));
  END IF;
END $$;

-- Add last_seen_at column
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add updated_at column
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows to 'active' (avoid lockout)
UPDATE public.memberships SET status = 'active' WHERE status IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON public.memberships(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);

-- Add updated_at trigger for memberships
DROP TRIGGER IF EXISTS memberships_updated_at ON public.memberships;
CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. CREATE role_permissions TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT PRIMARY KEY,
  can_view_bookkeeping BOOLEAN NOT NULL DEFAULT false,
  can_edit_bookkeeping BOOLEAN NOT NULL DEFAULT false,
  can_export_bookkeeping BOOLEAN NOT NULL DEFAULT false,
  can_manage_invites BOOLEAN NOT NULL DEFAULT false,
  can_manage_users BOOLEAN NOT NULL DEFAULT false,
  can_manage_account_assignments BOOLEAN NOT NULL DEFAULT false
);

-- Add constraint for role values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_check'
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_role_check
      CHECK (role IN ('admin', 'va', 'client'));
  END IF;
END $$;

-- Seed defaults (upsert to avoid duplicates)
INSERT INTO public.role_permissions (role, can_view_bookkeeping, can_edit_bookkeeping, can_export_bookkeeping, can_manage_invites, can_manage_users, can_manage_account_assignments)
VALUES
  ('admin', true, true, true, true, true, true),
  ('va', true, true, false, false, false, false),
  ('client', true, false, false, false, false, false)
ON CONFLICT (role) DO UPDATE SET
  can_view_bookkeeping = EXCLUDED.can_view_bookkeeping,
  can_edit_bookkeeping = EXCLUDED.can_edit_bookkeeping,
  can_export_bookkeeping = EXCLUDED.can_export_bookkeeping,
  can_manage_invites = EXCLUDED.can_manage_invites,
  can_manage_users = EXCLUDED.can_manage_users,
  can_manage_account_assignments = EXCLUDED.can_manage_account_assignments;

-- ============================================================
-- 3. CREATE user_permission_overrides TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_bookkeeping BOOLEAN,
  can_edit_bookkeeping BOOLEAN,
  can_export_bookkeeping BOOLEAN,
  can_manage_invites BOOLEAN,
  can_manage_users BOOLEAN,
  can_manage_account_assignments BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- 4. CREATE audit_logs TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before JSONB,
  after JSONB,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, created_at DESC);

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- role_permissions: authenticated can read
DROP POLICY IF EXISTS "Authenticated can read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated can read role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- role_permissions: admin can manage (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- user_permission_overrides: user can read own
DROP POLICY IF EXISTS "Users can view own overrides" ON public.user_permission_overrides;
CREATE POLICY "Users can view own overrides" ON public.user_permission_overrides
  FOR SELECT USING (auth.uid() = user_id);

-- user_permission_overrides: admin can manage all
DROP POLICY IF EXISTS "Admins can manage overrides" ON public.user_permission_overrides;
CREATE POLICY "Admins can manage overrides" ON public.user_permission_overrides
  FOR ALL USING (public.is_admin(auth.uid()));

-- audit_logs: admin can read
DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- memberships: add policy for admin to UPDATE status/role/department
-- (memberships already has SELECT policies from 001_auth_schema.sql)
DROP POLICY IF EXISTS "Admins can update memberships status" ON public.memberships;
CREATE POLICY "Admins can update memberships status" ON public.memberships
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 6. UPDATE provision_user_on_signup TRIGGER
-- ============================================================
-- CRITICAL: Remove membership creation - that's now done by /auth/bootstrap
-- This ensures invite-only access is enforced

CREATE OR REPLACE FUNCTION public.provision_user_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog, extensions'
AS $$
BEGIN
  -- Create profile only (identity data)
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- DO NOT insert into memberships here - that's done by /auth/bootstrap
  -- This ensures invite-only access is properly enforced
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. GRANT PERMISSIONS for service role to insert audit_logs
-- ============================================================
-- Service role can bypass RLS, but we still grant explicit permissions
GRANT INSERT ON public.audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.memberships TO service_role;
GRANT SELECT ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_permission_overrides TO service_role;
GRANT SELECT, UPDATE ON public.invites TO service_role;
GRANT SELECT, INSERT ON public.profiles TO service_role;

-- ============================================================
-- PATCH: Make memberships safe + readable for middleware
-- ============================================================

-- 1) Ensure exactly 1 membership per (org_id, user_id) (required because code uses .single())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'memberships_org_user_unique'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_org_user_unique UNIQUE (org_id, user_id);
  END IF;
END $$;

-- 2) Ensure users can read their own membership (middleware depends on this)
-- (Safe even if it already exists: we drop+recreate)
DROP POLICY IF EXISTS "Users can view own membership" ON public.memberships;
CREATE POLICY "Users can view own membership"
  ON public.memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3) Optional but smart: prevent disabled/pending “admins” from using admin powers
-- (Only if your is_admin() doesn't already check status)
-- NOTE: This depends on how public.is_admin is implemented.

-- 4) Grants: only needed if you don't already have default privileges set
-- These are safe; if already granted, they no-op.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT ON public.user_permission_overrides TO authenticated;

-- ============================================================
-- FK: memberships.user_id -> profiles.user_id
-- Enables PostgREST joins between memberships and profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
