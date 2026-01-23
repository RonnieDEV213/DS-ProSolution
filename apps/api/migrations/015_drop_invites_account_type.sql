-- Migration 015: Drop legacy invites.account_type column
-- DESTRUCTIVE: Run after code has been migrated to use invites.user_type (migration 013)
-- Idempotent: safe if already dropped

BEGIN;

ALTER TABLE public.invites
  DROP COLUMN IF EXISTS account_type;

COMMIT;
