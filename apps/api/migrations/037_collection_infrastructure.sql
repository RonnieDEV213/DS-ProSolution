-- Migration: 037_collection_infrastructure.sql
-- Purpose: Create collection infrastructure schema for jobs, state, and sellers
-- Phase: 06-collection-infrastructure, Plan: 01

-- ============================================================
-- 1. collection_settings (Global admin settings per org)
-- ============================================================
-- Stores per-org budget and concurrency configuration.
-- One settings row per org (org_id UNIQUE).
-- budget_cap_cents is per individual run (not cumulative).

CREATE TABLE collection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  budget_cap_cents INT NOT NULL DEFAULT 2500,  -- Default $25 per run
  soft_warning_percent INT NOT NULL DEFAULT 80,
  max_concurrent_runs INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Index for org lookup
CREATE INDEX idx_collection_settings_org_id ON collection_settings(org_id);

-- ============================================================
-- 2. collection_runs (Job state with checkpointing)
-- ============================================================
-- Tracks each collection run with progress and checkpoint support.
-- Status state machine: pending -> running -> completed/failed/cancelled
--                       running -> paused -> running (resume)
-- checkpoint JSONB stores resume position for crash recovery.

CREATE TABLE collection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- Custom name or auto-generated "Collection 2026-01-20 14:30"
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),

  -- Cost tracking
  estimated_cost_cents INT NOT NULL,
  actual_cost_cents INT NOT NULL DEFAULT 0,
  budget_cap_cents INT NOT NULL,  -- Snapshot at run start

  -- Progress tracking
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,

  -- Checkpoint for resume (JSONB for flexibility)
  checkpoint JSONB,  -- {current_category_id, current_item_index, ...}

  -- Categories selected (array of category IDs)
  category_ids TEXT[] NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_collection_runs_org_id ON collection_runs(org_id);
CREATE INDEX idx_collection_runs_status ON collection_runs(status);
CREATE INDEX idx_collection_runs_created_at ON collection_runs(created_at DESC);

-- ============================================================
-- 3. collection_items (Per-item log)
-- ============================================================
-- Tracks each item processed within a run.
-- item_type: 'amazon_product' or 'ebay_seller'
-- external_id: ASIN for Amazon, seller ID for eBay
-- data JSONB stores flexible API response data.

CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,

  -- Item identity
  item_type TEXT NOT NULL CHECK (item_type IN ('amazon_product', 'ebay_seller')),
  external_id TEXT NOT NULL,  -- ASIN or seller ID

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Data (JSONB for flexibility during API integration)
  data JSONB,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Cost tracking
  cost_cents INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_collection_items_run_id ON collection_items(run_id);
CREATE INDEX idx_collection_items_status ON collection_items(status);
CREATE INDEX idx_collection_items_item_type ON collection_items(item_type);

-- ============================================================
-- 4. sellers (Deduplicated master list)
-- ============================================================
-- Master list of discovered sellers, deduplicated by normalized name.
-- normalized_name: lowercase, stripped for deduplication.
-- times_seen tracks how often seller appears across runs.

CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

  -- Identity
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,  -- Lowercase, stripped for dedup
  platform TEXT NOT NULL CHECK (platform IN ('ebay')),
  platform_id TEXT,  -- eBay seller ID if available

  -- Source tracking
  first_seen_run_id UUID REFERENCES collection_runs(id) ON DELETE SET NULL,
  last_seen_run_id UUID REFERENCES collection_runs(id) ON DELETE SET NULL,
  times_seen INT NOT NULL DEFAULT 1,

  -- Metadata (optional)
  feedback_score INT,
  item_count INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,

  -- Unique constraint: one normalized name per org per platform
  CONSTRAINT sellers_unique_normalized UNIQUE (org_id, normalized_name, platform)
);

-- Indexes for common queries
CREATE INDEX idx_sellers_org_id ON sellers(org_id);
CREATE INDEX idx_sellers_normalized_name ON sellers(normalized_name);

-- ============================================================
-- 5. RLS policies (service role only)
-- ============================================================
-- All tables use service_role bypass for now.
-- Future phases may add user-facing policies for read access.

ALTER TABLE collection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_collection_settings" ON collection_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_collection_runs" ON collection_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_collection_items" ON collection_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_sellers" ON sellers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
