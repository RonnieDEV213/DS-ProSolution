-- ============================================================
-- Migration 020: Drop legacy columns
-- ============================================================
-- DESTRUCTIVE: Only run after 019 is verified
-- ============================================================

-- 1. Drop can_write column from account_assignments
ALTER TABLE public.account_assignments DROP COLUMN IF EXISTS can_write;

-- 2. Drop department column from memberships
ALTER TABLE public.memberships DROP COLUMN IF EXISTS department;

-- 3. Drop department column from invites
ALTER TABLE public.invites DROP COLUMN IF EXISTS department;

-- ============================================================
-- Verification Queries (run after migration)
-- ============================================================
--
-- 1. Confirm can_write column dropped:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'account_assignments' AND column_name = 'can_write';
--    -- Should return 0 rows
--
-- 2. Confirm department columns dropped:
--    SELECT table_name, column_name FROM information_schema.columns
--    WHERE column_name = 'department' AND table_name IN ('memberships', 'invites');
--    -- Should return 0 rows
-- ============================================================
