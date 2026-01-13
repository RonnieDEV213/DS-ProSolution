-- Migration 014: Drop legacy department columns
-- DESTRUCTIVE: Only run after code changes are verified in production
-- DO NOT RUN YET - This is a stub for future cleanup

-- BEGIN;

-- Drop department column from memberships
-- ALTER TABLE public.memberships DROP COLUMN IF EXISTS department;

-- Drop department column from invites
-- ALTER TABLE public.invites DROP COLUMN IF EXISTS department;

-- COMMIT;
