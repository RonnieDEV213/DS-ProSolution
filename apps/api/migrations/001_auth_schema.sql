-- ============================================================
-- DS-ProSolution: Invite-Only Authentication Schema
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0. EXTENSION: citext
-- ============================================================
-- Install citext in the 'extensions' schema (Supabase default).
-- This is where Supabase places extensions by default.
-- If your project uses a different schema, adjust accordingly.

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- Note: citext is now available as extensions.citext
-- Functions that need citext must include 'extensions' in their search_path

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Default org UUID for MVP: a0000000-0000-0000-0000-000000000001

-- profiles: extends auth.users with app-specific data
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email extensions.citext NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- invites: pre-authorized emails that can sign up
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email extensions.citext NOT NULL,
  org_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::UUID,
  account_type TEXT NOT NULL CHECK (account_type IN ('admin', 'va', 'client')),
  department TEXT CHECK (department IS NULL OR department IN ('ordering', 'listing', 'cs', 'returns', 'general')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Partial unique index: only one ACTIVE invite per email
CREATE UNIQUE INDEX idx_invites_active_email
  ON public.invites(email)
  WHERE status = 'active';

-- memberships: user role assignments per org
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::UUID,
  role TEXT NOT NULL CHECK (role IN ('admin', 'va', 'client')),
  department TEXT CHECK (department IS NULL OR department IN ('ordering', 'listing', 'cs', 'returns', 'general')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- Indexes
CREATE INDEX idx_invites_email ON public.invites(email);
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_org_id ON public.memberships(org_id);

-- Updated_at trigger function (no citext needed here)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. AUTH HOOK: Before User Created
-- ============================================================
-- Validates that an active, unexpired invite exists for the email
-- Payload: { "metadata": {...}, "user": { "id", "email", ... } }
-- Return: '{}' to allow, or { "error": { "http_code", "message" } } to reject
-- Ref: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
--
-- SECURITY: Uses SECURITY DEFINER with restricted search_path.
-- search_path includes 'extensions' for citext type resolution.
-- All table references are fully-qualified (public.*).

CREATE OR REPLACE FUNCTION public.check_invite_before_user_created(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog, extensions'
AS $$
DECLARE
  user_email TEXT;
  invite_exists BOOLEAN;
BEGIN
  -- Extract email from event->'user'->>'email'
  user_email := event->'user'->>'email';

  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Email is required.'
      )
    );
  END IF;

  -- Check for valid active invite
  -- Comparing TEXT to citext column auto-coerces to case-insensitive
  SELECT EXISTS (
    SELECT 1
    FROM public.invites
    WHERE email = user_email
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO invite_exists;

  IF NOT invite_exists THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'No valid invite found for this email. Please contact an administrator.'
      )
    );
  END IF;

  -- Allow user creation
  RETURN '{}'::jsonb;
END;
$$;

-- Grant permissions for hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.check_invite_before_user_created(JSONB) TO supabase_auth_admin;
GRANT SELECT ON TABLE public.invites TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.check_invite_before_user_created(JSONB) FROM authenticated, anon, public;

-- ============================================================
-- 3. TRIGGER: Auto-Provision on User Creation
-- ============================================================
-- Creates profile + membership when a new user is inserted into auth.users
--
-- SECURITY: Uses SECURITY DEFINER with restricted search_path.
-- search_path includes 'extensions' for citext type resolution.
-- All table references are fully-qualified (public.*).

CREATE OR REPLACE FUNCTION public.provision_user_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog, extensions'
AS $$
DECLARE
  user_email TEXT;
  invite_record RECORD;
BEGIN
  -- Store email as TEXT; citext column handles case-insensitive comparison
  user_email := NEW.email;

  -- Find the active invite
  SELECT * INTO invite_record
  FROM public.invites
  WHERE email = user_email
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    -- Should not happen (hook should block), but handle gracefully
    RAISE LOG 'provision_user_on_signup: No invite found for user %', user_email;
    RETURN NEW;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    user_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Create membership
  INSERT INTO public.memberships (user_id, org_id, role, department)
  VALUES (
    NEW.id,
    invite_record.org_id,
    invite_record.account_type,
    invite_record.department
  )
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Mark invite as used
  UPDATE public.invites
  SET status = 'used', used_at = NOW()
  WHERE id = invite_record.id;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_user_on_signup();

-- Grant permissions for provisioning
GRANT EXECUTE ON FUNCTION public.provision_user_on_signup() TO supabase_auth_admin;
GRANT SELECT, UPDATE ON TABLE public.invites TO supabase_auth_admin;
GRANT INSERT ON TABLE public.profiles TO supabase_auth_admin;
GRANT INSERT ON TABLE public.memberships TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.provision_user_on_signup() FROM authenticated, anon, public;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Helper function: is user admin?
-- No citext needed here, so empty search_path is safe
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id AND role = 'admin'
  );
END;
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Memberships policies
CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all memberships" ON public.memberships
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert memberships" ON public.memberships
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update memberships" ON public.memberships
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Invites policies (admin only)
CREATE POLICY "Admins can view invites" ON public.invites
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert invites" ON public.invites
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update invites" ON public.invites
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 5. BOOTSTRAP: First Admin Invite
-- ============================================================
-- IMPORTANT: Replace <YOUR_ADMIN_EMAIL> with your actual admin email!

-- INSERT INTO public.invites (email, account_type)
-- VALUES ('<YOUR_ADMIN_EMAIL>', 'admin');
