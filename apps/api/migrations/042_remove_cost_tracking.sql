-- Migration: 042_remove_cost_tracking.sql
-- Purpose: Remove cost/budget tracking columns (flat-rate Oxylabs subscription)
-- Phase: 09-storage-export-collection-ui

-- Remove from collection_settings
ALTER TABLE collection_settings DROP COLUMN IF EXISTS budget_cap_cents;
ALTER TABLE collection_settings DROP COLUMN IF EXISTS soft_warning_percent;

-- Remove from collection_runs
ALTER TABLE collection_runs DROP COLUMN IF EXISTS estimated_cost_cents;
ALTER TABLE collection_runs DROP COLUMN IF EXISTS actual_cost_cents;
ALTER TABLE collection_runs DROP COLUMN IF EXISTS budget_cap_cents;

-- Remove from collection_items
ALTER TABLE collection_items DROP COLUMN IF EXISTS cost_cents;
