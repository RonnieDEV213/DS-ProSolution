-- Migration: 054_export_flag_audit.sql
-- Purpose: Extend seller_audit_log to support export and flag action types

-- Drop existing action check constraint
ALTER TABLE seller_audit_log
DROP CONSTRAINT IF EXISTS seller_audit_log_action_check;

-- Add updated action check constraint with export and flag
ALTER TABLE seller_audit_log
ADD CONSTRAINT seller_audit_log_action_check
CHECK (action IN ('add', 'edit', 'remove', 'export', 'flag'));

-- Drop existing source check constraint and re-add with 'export' value
ALTER TABLE seller_audit_log
DROP CONSTRAINT IF EXISTS seller_audit_log_source_check;

ALTER TABLE seller_audit_log
ADD CONSTRAINT seller_audit_log_source_check
CHECK (source IN ('manual', 'collection_run', 'auto_remove', 'export'));

-- Index for action-based filtering (improves filter chip queries)
CREATE INDEX IF NOT EXISTS idx_seller_audit_log_action
ON seller_audit_log(org_id, action, created_at DESC);
