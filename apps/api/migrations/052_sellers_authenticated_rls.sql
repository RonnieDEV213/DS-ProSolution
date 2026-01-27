-- ============================================================
-- Migration 052: Authenticated user RLS SELECT policy on sellers
--                + backfill NULL updated_at
-- ============================================================
--
-- Root cause: The /sync/sellers endpoint uses get_supabase_for_user()
-- which creates a user-scoped Supabase client subject to RLS.
-- The sellers table (migration 037) only has a service_role policy,
-- so Supabase silently returns 0 rows for authenticated users.
--
-- Fix: Add an org-scoped SELECT policy for authenticated users,
-- matching the established pattern from migrations 036 and 049.
--
-- Also: Backfill sellers with NULL updated_at (migration 037 defined
-- the column as nullable with no default). The sync endpoint orders
-- by updated_at DESC and encodes it into pagination cursors, so NULL
-- values crash cursor encoding.
--
-- The existing service_role_sellers policy is NOT modified.
-- Only SELECT is added because the sync endpoint only reads;
-- mutations go through the API service role client.
-- ============================================================

-- 1. RLS policy (idempotent)
DROP POLICY IF EXISTS "authenticated_select_sellers" ON sellers;

CREATE POLICY "authenticated_select_sellers"
ON sellers
FOR SELECT
TO authenticated
USING (
    org_id IN (
        SELECT org_id FROM memberships
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- 2. Backfill NULL updated_at with created_at
UPDATE sellers SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Add default so future inserts always get updated_at
ALTER TABLE sellers ALTER COLUMN updated_at SET DEFAULT now();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
