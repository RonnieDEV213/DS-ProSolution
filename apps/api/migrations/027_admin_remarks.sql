-- ============================================================
-- Migration 027: Admin Remarks Tables
-- ============================================================
-- Creates separate admin-only tables for storing internal notes
-- on profiles, accounts, and department roles.
-- Uses strict RLS policies to prevent data leakage.
-- ============================================================

-- Admin remarks stored in separate tables with admin-only RLS

-- 1) Profile admin notes
-- NOTE: profiles table uses user_id as its PRIMARY KEY (no separate id column)
-- Therefore we reference profiles(user_id) directly
CREATE TABLE IF NOT EXISTS public.profile_admin_notes (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  admin_remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profile_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read profile admin notes"
  ON public.profile_admin_notes FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profile admin notes"
  ON public.profile_admin_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update profile admin notes"
  ON public.profile_admin_notes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profile admin notes"
  ON public.profile_admin_notes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_admin_notes TO authenticated;

-- 2) Account admin notes
CREATE TABLE IF NOT EXISTS public.account_admin_notes (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  admin_remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read account admin notes"
  ON public.account_admin_notes FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert account admin notes"
  ON public.account_admin_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update account admin notes"
  ON public.account_admin_notes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete account admin notes"
  ON public.account_admin_notes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_admin_notes TO authenticated;

-- 3) Department role admin notes
CREATE TABLE IF NOT EXISTS public.department_role_admin_notes (
  department_role_id UUID PRIMARY KEY REFERENCES public.department_roles(id) ON DELETE CASCADE,
  admin_remarks TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.department_role_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read department role admin notes"
  ON public.department_role_admin_notes FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert department role admin notes"
  ON public.department_role_admin_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update department role admin notes"
  ON public.department_role_admin_notes FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete department role admin notes"
  ON public.department_role_admin_notes FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_role_admin_notes TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
