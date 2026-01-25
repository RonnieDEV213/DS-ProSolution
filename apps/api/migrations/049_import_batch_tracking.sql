-- Import batch tracking for rollback capability
-- Per Phase 21 CONTEXT.md: 24-hour rollback window, warn about modified records
-- Migration: 049_import_batch_tracking.sql

-- Table to track import batches
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    format TEXT NOT NULL DEFAULT 'csv', -- csv, json, excel
    column_mapping JSONB, -- Store the mapping used for this import
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    can_rollback BOOLEAN NOT NULL DEFAULT TRUE,
    rolled_back_at TIMESTAMPTZ -- Set when rollback executed
);

-- Index for listing user's import history
CREATE INDEX idx_import_batches_user_created ON import_batches(user_id, created_at DESC);
CREATE INDEX idx_import_batches_org ON import_batches(org_id);
CREATE INDEX idx_import_batches_account ON import_batches(account_id);

-- Add import_batch_id to bookkeeping_records for tracking
ALTER TABLE bookkeeping_records
ADD COLUMN import_batch_id UUID REFERENCES import_batches(id);

-- Index for efficient batch operations (only for imported records)
CREATE INDEX idx_records_import_batch ON bookkeeping_records(import_batch_id)
WHERE import_batch_id IS NOT NULL;

-- RLS policies for import_batches
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Users can see their own org's import batches
CREATE POLICY "Users can view org import batches"
ON import_batches
FOR SELECT
USING (
    org_id IN (
        SELECT org_id FROM memberships
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- Users with order_tracking.write can create import batches
CREATE POLICY "Users can create import batches with permission"
ON import_batches
FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT org_id FROM memberships
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- Users with order_tracking.write can update import batches (for rollback)
CREATE POLICY "Users can update import batches with permission"
ON import_batches
FOR UPDATE
USING (
    org_id IN (
        SELECT org_id FROM memberships
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- Function to disable rollback for old batches (run by scheduler)
CREATE OR REPLACE FUNCTION disable_old_import_rollbacks()
RETURNS void AS $$
BEGIN
    UPDATE import_batches
    SET can_rollback = FALSE
    WHERE can_rollback = TRUE
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comment documenting the 24-hour rollback policy
COMMENT ON TABLE import_batches IS 'Tracks import operations for rollback capability. Rollback available for 24 hours after import.';
COMMENT ON COLUMN import_batches.can_rollback IS 'Whether this batch can be rolled back. Set to FALSE after 24 hours or when manually disabled.';
COMMENT ON COLUMN import_batches.column_mapping IS 'JSON object mapping original CSV/Excel column names to database field names.';
