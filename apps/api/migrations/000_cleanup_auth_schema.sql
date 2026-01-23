-- ============================================================
-- DS-ProSolution: Cleanup Script for Failed 001_auth_schema.sql
-- ============================================================
-- Run this cleanup script ONLY if 001_auth_schema.sql failed mid-way.
-- This script is fully idempotent - safe to run even if no objects exist.
-- After running this, you can re-run the fixed 001_auth_schema.sql.
-- ============================================================

-- 1. Drop trigger on auth.users (this table always exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop tables (CASCADE auto-removes triggers, policies, indexes, constraints)
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.invites CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Drop functions
DROP FUNCTION IF EXISTS public.check_invite_before_user_created(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.provision_user_on_signup() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

-- Note: We do NOT drop the citext extension as it may be used by other things.
-- If you need to drop it: DROP EXTENSION IF EXISTS citext;

-- ============================================================
-- Cleanup complete. You can now re-run 001_auth_schema.sql
-- ============================================================
