-- Migration: 040_enhanced_progress.sql
-- Purpose: Enhanced progress tracking for collection runs

-- Add hierarchical progress columns to collection_runs
ALTER TABLE collection_runs
ADD COLUMN IF NOT EXISTS departments_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS departments_completed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS categories_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS categories_completed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_searched INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS sellers_found INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS sellers_new INTEGER NOT NULL DEFAULT 0;

-- Add current worker status for live progress display
ALTER TABLE collection_runs
ADD COLUMN IF NOT EXISTS worker_status JSONB NOT NULL DEFAULT '[]'::JSONB;
-- Structure: [{ "worker_id": 1, "department": "Electronics", "category": "Laptops", "product": "MacBook Pro", "status": "searching" }, ...]

-- Add template reference
ALTER TABLE collection_runs
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES run_templates(id) ON DELETE SET NULL;

-- Comments
COMMENT ON COLUMN collection_runs.worker_status IS 'Real-time status of each concurrent worker: department, category, current product';
COMMENT ON COLUMN collection_runs.departments_total IS 'Total Amazon Best Sellers departments being processed';
COMMENT ON COLUMN collection_runs.sellers_new IS 'New unique sellers added (not already in master list)';
