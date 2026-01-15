-- 009_drop_user_permission_overrides.sql
-- Drop the legacy user_permission_overrides table.
--
-- This table is no longer used after the department roles migration:
-- - C4: Migrated TRUE bookkeeping overrides to dept role assignments
-- - C6A: Removed all runtime queries/upserts
-- - C6B: Removed legacy fallback in require_permission_key()
--
-- RLS policies are dropped automatically with the table.
-- Safe to re-run (idempotent).

DROP TABLE IF EXISTS public.user_permission_overrides;
