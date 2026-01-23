-- Migration: 038_seller_audit_log.sql
-- Purpose: Audit log for seller changes (add/edit/remove)

-- Seller audit log table
CREATE TABLE IF NOT EXISTS seller_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

    -- What changed
    action TEXT NOT NULL CHECK (action IN ('add', 'edit', 'remove')),
    seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
    seller_name TEXT NOT NULL,  -- Capture name at time of action
    old_value JSONB,  -- Previous state for edits
    new_value JSONB,  -- New state for edits/adds

    -- Source of change
    source TEXT NOT NULL CHECK (source IN ('manual', 'collection_run', 'auto_remove')),
    source_run_id UUID REFERENCES collection_runs(id) ON DELETE SET NULL,
    source_criteria JSONB,  -- For auto_remove: what criteria matched

    -- Who made the change
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- When
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Affected count (for bulk operations)
    affected_count INTEGER NOT NULL DEFAULT 1
);

-- Indexes for common queries
CREATE INDEX idx_seller_audit_log_org ON seller_audit_log(org_id);
CREATE INDEX idx_seller_audit_log_created ON seller_audit_log(created_at DESC);
CREATE INDEX idx_seller_audit_log_source_run ON seller_audit_log(source_run_id) WHERE source_run_id IS NOT NULL;

-- RLS policies
ALTER TABLE seller_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_seller_audit_log" ON seller_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comment
COMMENT ON TABLE seller_audit_log IS 'Audit trail for all seller changes - manual edits, collection runs, auto-removals';
