-- ============================================================
-- Migration 030: Account-Based Auto-Reconnect
-- ============================================================
-- Enables extension auto-reconnect by matching account keys.
-- Adds approval_status separate from runtime status.
-- Two-phase replacement ensures safe reinstalls.
-- ============================================================

-- 1. Add approval_status to agents (separate from runtime status)
ALTER TABLE public.automation_agents
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revoked', 'replacing'));

-- 2. Add account identifier columns to agents
ALTER TABLE public.automation_agents
ADD COLUMN IF NOT EXISTS ebay_account_key TEXT,
ADD COLUMN IF NOT EXISTS amazon_account_key TEXT,
ADD COLUMN IF NOT EXISTS ebay_account_display TEXT,
ADD COLUMN IF NOT EXISTS amazon_account_display TEXT,
ADD COLUMN IF NOT EXISTS replaced_by_id UUID REFERENCES public.automation_agents(id),
ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

-- 3. Add account identifier columns to pairing requests
ALTER TABLE public.automation_pairing_requests
ADD COLUMN IF NOT EXISTS ebay_account_key TEXT,
ADD COLUMN IF NOT EXISTS amazon_account_key TEXT,
ADD COLUMN IF NOT EXISTS ebay_account_display TEXT,
ADD COLUMN IF NOT EXISTS amazon_account_display TEXT,
ADD COLUMN IF NOT EXISTS detected_role TEXT CHECK (detected_role IN ('EBAY_AGENT', 'AMAZON_AGENT'));

-- 4. Indexes for auto-approve lookup (only approved agents)
CREATE INDEX IF NOT EXISTS idx_agents_ebay_key_approved
ON public.automation_agents(ebay_account_key)
WHERE ebay_account_key IS NOT NULL AND approval_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_agents_amazon_key_approved
ON public.automation_agents(amazon_account_key)
WHERE amazon_account_key IS NOT NULL AND approval_status = 'approved';

-- 5. Blocklist table
CREATE TABLE IF NOT EXISTS public.automation_blocked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ebay', 'amazon')),
  account_key TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE (org_id, provider, account_key)
);

ALTER TABLE public.automation_blocked_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_blocked_accounts TO service_role;

CREATE INDEX IF NOT EXISTS idx_blocked_accounts_lookup
ON public.automation_blocked_accounts(org_id, provider, account_key);

-- 6. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
