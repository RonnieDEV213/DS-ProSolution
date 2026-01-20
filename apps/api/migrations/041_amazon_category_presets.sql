-- Migration: 041_amazon_category_presets.sql
-- Purpose: Store Amazon category selection presets per organization
-- Phase: 07-amazon-best-sellers

-- ============================================================
-- Amazon Category Presets Table
-- ============================================================
-- Stores saved category selections (e.g., "My Favorite Categories")
-- category_ids array references IDs from static amazon_categories.json

CREATE TABLE amazon_category_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_ids TEXT[] NOT NULL,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,

    -- Prevent duplicate preset names within an org
    CONSTRAINT amazon_presets_unique_name UNIQUE (org_id, name)
);

-- Add comment for documentation
COMMENT ON TABLE amazon_category_presets IS 'Saved Amazon category selections for collection runs';
COMMENT ON COLUMN amazon_category_presets.category_ids IS 'Array of category IDs from amazon_categories.json (e.g., ["electronics-computers", "home-kitchen-dining"])';
COMMENT ON COLUMN amazon_category_presets.is_builtin IS 'True for system presets like "Select All", false for user-created';

-- ============================================================
-- Indexes
-- ============================================================

-- Index on org_id for listing presets
CREATE INDEX idx_amazon_presets_org ON amazon_category_presets(org_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE amazon_category_presets ENABLE ROW LEVEL SECURITY;

-- Service role bypass (consistent with other tables)
CREATE POLICY "service_role_amazon_presets" ON amazon_category_presets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
