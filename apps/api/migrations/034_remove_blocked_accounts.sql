-- ============================================================
-- Migration 034: Remove Blocked Accounts System
-- ============================================================
-- Removes the blocked accounts feature entirely.
-- The auto-reconnect feature will still work, just without
-- the ability to block specific accounts from auto-approving.
-- ============================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_blocked_accounts_lookup;

-- Drop the blocked accounts table
DROP TABLE IF EXISTS public.automation_blocked_accounts;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
