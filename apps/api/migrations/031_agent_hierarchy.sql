-- ============================================================
-- Migration 031: Agent Hierarchy (Account → eBay → Amazon)
-- ============================================================
-- Creates cascade delete chain:
--   Account → eBay Agent → Amazon Agent(s)
--
-- Rules:
--   - Account can exist without agents
--   - eBay agent requires account (CASCADE delete)
--   - Amazon agent requires eBay agent (CASCADE delete)
-- ============================================================

-- Step 1: Add ebay_agent_id column to automation_agents for Amazon agents
ALTER TABLE public.automation_agents
ADD COLUMN IF NOT EXISTS ebay_agent_id UUID;

-- Step 2: Populate ebay_agent_id for existing Amazon agents
-- Find the eBay agent for the same account and link to it
UPDATE public.automation_agents amazon
SET ebay_agent_id = ebay.id
FROM public.automation_agents ebay
WHERE amazon.role = 'AMAZON_AGENT'
  AND ebay.role = 'EBAY_AGENT'
  AND amazon.account_id = ebay.account_id
  AND ebay.status = 'active'
  AND amazon.ebay_agent_id IS NULL;

-- Step 3: Drop old foreign key constraint
ALTER TABLE public.automation_agents
DROP CONSTRAINT IF EXISTS automation_agents_account_id_fkey;

-- Step 4: Add new foreign key for eBay agents (account_id → accounts) with CASCADE
ALTER TABLE public.automation_agents
ADD CONSTRAINT automation_agents_account_id_fkey
FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Step 5: Add foreign key for Amazon agents (ebay_agent_id → automation_agents) with CASCADE
ALTER TABLE public.automation_agents
ADD CONSTRAINT automation_agents_ebay_agent_id_fkey
FOREIGN KEY (ebay_agent_id) REFERENCES public.automation_agents(id) ON DELETE CASCADE;

-- Step 6: Clear account_id for Amazon agents (they link via ebay_agent_id now)
UPDATE public.automation_agents
SET account_id = NULL
WHERE role = 'AMAZON_AGENT';

-- Step 7: Add check constraints to enforce hierarchy rules
-- eBay agents must have account_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_ebay_agent_has_account'
  ) THEN
    ALTER TABLE public.automation_agents
    ADD CONSTRAINT chk_ebay_agent_has_account
    CHECK (role != 'EBAY_AGENT' OR account_id IS NOT NULL);
  END IF;
END $$;

-- Amazon agents must have ebay_agent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_amazon_agent_has_ebay_agent'
  ) THEN
    ALTER TABLE public.automation_agents
    ADD CONSTRAINT chk_amazon_agent_has_ebay_agent
    CHECK (role != 'AMAZON_AGENT' OR ebay_agent_id IS NOT NULL);
  END IF;
END $$;

-- Step 8: Update indexes for better query performance
DROP INDEX IF EXISTS idx_automation_agents_account;
CREATE INDEX IF NOT EXISTS idx_automation_agents_account
  ON public.automation_agents(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_agents_ebay_agent
  ON public.automation_agents(ebay_agent_id)
  WHERE ebay_agent_id IS NOT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
