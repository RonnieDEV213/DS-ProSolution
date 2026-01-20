-- Migration: 039_run_templates.sql
-- Purpose: Save collection run configurations as reusable templates

CREATE TABLE IF NOT EXISTS run_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

    -- Template info
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    -- Configuration
    department_ids TEXT[] NOT NULL DEFAULT '{}',  -- Which departments to include
    concurrency INTEGER NOT NULL DEFAULT 3 CHECK (concurrency >= 1 AND concurrency <= 10),

    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique name per org
    UNIQUE (org_id, name)
);

-- Only one default template per org
CREATE UNIQUE INDEX idx_run_templates_default ON run_templates(org_id) WHERE is_default = TRUE;

-- RLS policies
ALTER TABLE run_templates ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_run_templates" ON run_templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comment
COMMENT ON TABLE run_templates IS 'Saved configurations for collection runs - departments, concurrency, etc.';
