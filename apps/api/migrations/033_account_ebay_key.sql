-- ============================================================
-- Migration 033: Add ebay_account_key to accounts for matching
-- ============================================================
-- Purpose: Enable auto-linking eBay agents to existing accounts
-- by matching on ebay_account_key instead of creating duplicates.
--
-- Also sets account.name = ebay_account_key for display purposes.
-- ============================================================

-- Step 1: Add ebay_account_key column to accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS ebay_account_key TEXT;

-- Step 2: Create unique index (one account per eBay seller per org)
-- This prevents duplicate accounts for the same eBay seller
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_ebay_key_unique
ON public.accounts(org_id, ebay_account_key)
WHERE ebay_account_key IS NOT NULL;

-- Step 3: Backfill existing accounts from their eBay agents
-- Set both ebay_account_key (for matching) and name (for display)
UPDATE public.accounts a
SET
  ebay_account_key = ea.ebay_account_key,
  name = COALESCE(a.name, ea.ebay_account_key)
FROM public.automation_agents ea
WHERE ea.account_id = a.id
  AND ea.role = 'EBAY_AGENT'
  AND ea.ebay_account_key IS NOT NULL
  AND a.ebay_account_key IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
