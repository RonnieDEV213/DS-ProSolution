-- Migration 036: Presence System
-- Tracks which VA is working on which account for real-time occupancy visibility.
--
-- Key constraints:
--   - One VA per account (account_id unique)
--   - One account per VA per org (user_id, org_id unique)
--
-- RLS: Authenticated users can view presence for their org.
-- Privacy filtering (admin sees name, VA sees "Occupied") is done in application layer.

-- ============================================================
-- Account Presence Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  clocked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One VA per account constraint
  CONSTRAINT account_presence_account_unique UNIQUE (account_id),
  -- One account per VA per org constraint (VA can only be on one account at a time)
  CONSTRAINT account_presence_user_org_unique UNIQUE (user_id, org_id)
);

-- Index for org-based queries (list all presence for an org)
CREATE INDEX IF NOT EXISTS idx_account_presence_org ON account_presence(org_id);

-- ============================================================
-- Enable Supabase Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE account_presence;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE account_presence ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "service_role_full_access" ON account_presence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can SELECT presence for their org
-- (both admins and VAs can see presence; privacy filtering in app layer)
CREATE POLICY "authenticated_read_own_org" ON account_presence
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.user_id = auth.uid()
      AND m.status = 'active'
    )
  );

-- ============================================================
-- Notify PostgREST to reload schema
-- ============================================================

NOTIFY pgrst, 'reload schema';
