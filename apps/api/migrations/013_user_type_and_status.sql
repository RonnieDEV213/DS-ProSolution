-- Migration 013: Add user_type columns and rename disabled -> suspended
-- This is an additive migration - safe to run multiple times
-- Production-hardened: handles missing source columns, normalizes data

BEGIN;

-- 1. Add user_type column to invites (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invites' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE public.invites ADD COLUMN user_type TEXT;
  END IF;
END $$;

-- 2. Backfill invites.user_type from account_type (only if account_type column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invites' AND column_name = 'account_type'
  ) THEN
    EXECUTE 'UPDATE public.invites SET user_type = account_type WHERE user_type IS NULL AND account_type IS NOT NULL';
  END IF;
END $$;

-- 3. Normalize invites.user_type: lowercase, trim, convert empty to NULL
UPDATE public.invites
SET user_type = lower(nullif(trim(user_type), ''))
WHERE user_type IS NOT NULL;

-- 4. Coerce invalid invites.user_type values to 'va' (least privilege default)
UPDATE public.invites
SET user_type = 'va'
WHERE user_type IS NULL OR user_type NOT IN ('admin', 'va', 'client');

-- 5. Add user_type column to memberships (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE public.memberships ADD COLUMN user_type TEXT;
  END IF;
END $$;

-- 6. Backfill memberships.user_type from role (only if role column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships' AND column_name = 'role'
  ) THEN
    EXECUTE 'UPDATE public.memberships SET user_type = role WHERE user_type IS NULL AND role IS NOT NULL';
  END IF;
END $$;

-- 7. Normalize memberships.user_type: lowercase, trim, convert empty to NULL
UPDATE public.memberships
SET user_type = lower(nullif(trim(user_type), ''))
WHERE user_type IS NOT NULL;

-- 8. Coerce invalid memberships.user_type values to 'va' (least privilege default)
UPDATE public.memberships
SET user_type = 'va'
WHERE user_type IS NULL OR user_type NOT IN ('admin', 'va', 'client');

-- 9. Add CHECK constraint for valid user_type values on invites (NOT VALID for reduced lock time)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'invites_user_type_check'
      AND t.relname = 'invites'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.invites
    ADD CONSTRAINT invites_user_type_check
    CHECK (user_type IN ('admin', 'va', 'client')) NOT VALID;
  END IF;
END $$;

-- 10. Validate the invites constraint (scans table but doesn't hold exclusive lock)
ALTER TABLE public.invites VALIDATE CONSTRAINT invites_user_type_check;

-- 11. Add CHECK constraint for valid user_type values on memberships (NOT VALID for reduced lock time)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'memberships_user_type_check'
      AND t.relname = 'memberships'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_user_type_check
    CHECK (user_type IN ('admin', 'va', 'client')) NOT VALID;
  END IF;
END $$;

-- 12. Validate the memberships constraint (scans table but doesn't hold exclusive lock)
ALTER TABLE public.memberships VALIDATE CONSTRAINT memberships_user_type_check;

-- 13. Rename 'disabled' -> 'suspended' in memberships.status (TEXT column)
UPDATE public.memberships
SET status = 'suspended'
WHERE status = 'disabled';

-- 14. Update the status check constraint to use new values
-- First, drop the old constraint if it exists
ALTER TABLE public.memberships
DROP CONSTRAINT IF EXISTS memberships_status_check;

-- Then add the new constraint (NOT VALID for reduced lock time)
ALTER TABLE public.memberships
ADD CONSTRAINT memberships_status_check
CHECK (status IN ('pending', 'active', 'suspended')) NOT VALID;

-- 15. Validate the status constraint
ALTER TABLE public.memberships VALIDATE CONSTRAINT memberships_status_check;

COMMIT;
