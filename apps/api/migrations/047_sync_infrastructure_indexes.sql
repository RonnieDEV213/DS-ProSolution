-- Migration: 047_sync_infrastructure_indexes.sql
-- Purpose: Create composite indexes for cursor-based pagination
-- Phase: 15-server-storage-foundation, Plan: 01
-- Depends on: 046_sync_infrastructure_columns.sql (updated_at, deleted_at columns)
--
-- These indexes enable efficient cursor-based pagination with O(log n) performance
-- regardless of page depth, supporting millions of records without degradation.
--
-- Cursor query pattern these indexes support:
--   SELECT * FROM {table}
--   WHERE {scope_id} = $1
--     AND (updated_at, id) < ($cursor_updated_at, $cursor_id)
--   ORDER BY updated_at DESC, id DESC
--   LIMIT 50;
--
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) because Supabase SQL Editor
-- runs statements in a transaction block. For initial setup this is fine.
-- For production tables with heavy traffic, run CONCURRENTLY via psql instead.

-- ============================================================
-- 1. Cursor indexes for sync queries (ordered by updated_at)
-- ============================================================

-- bookkeeping_records: account-scoped cursor pagination
CREATE INDEX IF NOT EXISTS idx_bookkeeping_records_cursor
  ON public.bookkeeping_records (account_id, updated_at DESC, id DESC);

-- accounts: org-scoped cursor pagination
CREATE INDEX IF NOT EXISTS idx_accounts_cursor
  ON public.accounts (org_id, updated_at DESC, id DESC);

-- sellers: org-scoped cursor pagination
CREATE INDEX IF NOT EXISTS idx_sellers_cursor
  ON public.sellers (org_id, updated_at DESC, id DESC);

-- ============================================================
-- 2. Partial indexes for active (non-deleted) records
-- ============================================================
-- Most queries filter out deleted records. Partial indexes are more efficient
-- because they're smaller and only include active rows.

-- bookkeeping_records: active records by sale_date (common query pattern)
CREATE INDEX IF NOT EXISTS idx_bookkeeping_records_active
  ON public.bookkeeping_records (account_id, sale_date DESC, id DESC)
  WHERE deleted_at IS NULL;

-- accounts: active accounts by org
CREATE INDEX IF NOT EXISTS idx_accounts_active
  ON public.accounts (org_id, id)
  WHERE deleted_at IS NULL;

-- sellers: active sellers by org with display name for listing
CREATE INDEX IF NOT EXISTS idx_sellers_active
  ON public.sellers (org_id, normalized_name)
  WHERE deleted_at IS NULL;
