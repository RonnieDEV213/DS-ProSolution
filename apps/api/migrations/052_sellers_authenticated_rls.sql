-- ============================================================
-- Migration 052: Authenticated user RLS SELECT policy on sellers
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
-- The existing service_role_sellers policy is NOT modified.
-- Only SELECT is added because the sync endpoint only reads;
-- mutations go through the API service role client.
-- ============================================================

-- Idempotent: drop if exists before creating
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
