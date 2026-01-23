-- Migration: 045_seller_snapshots.sql
-- Purpose: Store seller count snapshot for history "sellers at this point" display

-- Add snapshot count to collection_runs (for collection run entries)
ALTER TABLE collection_runs
ADD COLUMN IF NOT EXISTS seller_count_snapshot INTEGER;

-- Add snapshot count to seller_audit_log (for manual edit entries)
ALTER TABLE seller_audit_log
ADD COLUMN IF NOT EXISTS seller_count_snapshot INTEGER;

-- Comments
COMMENT ON COLUMN collection_runs.seller_count_snapshot IS 'Total seller count in org when this run completed';
COMMENT ON COLUMN seller_audit_log.seller_count_snapshot IS 'Total seller count in org after this change';
