-- ============================================================
-- Fix unique constraint to exclude soft-deleted records
-- ============================================================
-- Problem: The unique constraint on (account_id, ebay_order_id) includes
-- soft-deleted records, preventing re-import of records after account deletion.
--
-- Solution: Replace the constraint with a partial unique index that only
-- applies to non-deleted records (deleted_at IS NULL).
-- ============================================================

-- Step 1: Drop the existing unique constraint
-- (constraint may be named differently, try both patterns)
ALTER TABLE public.bookkeeping_records
  DROP CONSTRAINT IF EXISTS unique_account_ebay_order;

ALTER TABLE public.bookkeeping_records
  DROP CONSTRAINT IF EXISTS bookkeeping_records_account_id_ebay_order_id_key;

-- Also drop any existing index with this name
DROP INDEX IF EXISTS unique_account_ebay_order;
DROP INDEX IF EXISTS bookkeeping_records_account_id_ebay_order_id_key;

-- Step 2: Create a partial unique index that excludes soft-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS unique_account_ebay_order
  ON public.bookkeeping_records (account_id, ebay_order_id)
  WHERE deleted_at IS NULL;
