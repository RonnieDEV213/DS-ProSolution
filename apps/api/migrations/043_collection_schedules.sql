-- Migration: 042_collection_schedules.sql
-- Collection schedule configuration for cron-based automated runs

-- Collection schedules table (one per org for now)
CREATE TABLE IF NOT EXISTS collection_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    preset_id UUID REFERENCES amazon_category_presets(id) ON DELETE SET NULL,
    cron_expression TEXT NOT NULL DEFAULT '0 0 1 * *',  -- Default: 1st of month at midnight UTC
    enabled BOOLEAN NOT NULL DEFAULT false,
    notify_email BOOLEAN NOT NULL DEFAULT false,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id)  -- One schedule per org for simplicity
);

-- Index for loading enabled schedules
CREATE INDEX IF NOT EXISTS idx_collection_schedules_enabled
ON collection_schedules(enabled) WHERE enabled = true;

-- RLS policies
ALTER TABLE collection_schedules ENABLE ROW LEVEL SECURITY;

-- Admin can manage their org's schedule
CREATE POLICY "admin_manage_schedule" ON collection_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.org_id = collection_schedules.org_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Comment
COMMENT ON TABLE collection_schedules IS 'Cron-based schedule configuration for automated collection runs';
