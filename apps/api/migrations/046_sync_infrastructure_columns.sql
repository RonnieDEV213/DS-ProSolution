-- Migration: 046_sync_infrastructure_columns.sql
-- Purpose: Add updated_at and deleted_at columns with triggers for sync infrastructure
-- Phase: 15-server-storage-foundation, Plan: 01
--
-- This migration enables change tracking for cursor-based sync:
-- - updated_at: Auto-updates on any row modification (for cursor ordering)
-- - deleted_at: Soft delete timestamp (NULL = active, non-NULL = deleted)
--
-- The soft delete mechanism works because setting deleted_at is an UPDATE,
-- which triggers updated_at to update - clients detect deletions via updated_at in sync queries.

-- ============================================================
-- 1. bookkeeping_records - Add columns and trigger
-- ============================================================

-- Add sync infrastructure columns
ALTER TABLE public.bookkeeping_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create trigger using existing function from 001_auth_schema.sql
DROP TRIGGER IF EXISTS bookkeeping_records_updated_at ON public.bookkeeping_records;
CREATE TRIGGER bookkeeping_records_updated_at
  BEFORE UPDATE ON public.bookkeeping_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. accounts - Add columns and trigger
-- ============================================================

-- Add sync infrastructure columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create trigger using existing function from 001_auth_schema.sql
DROP TRIGGER IF EXISTS accounts_updated_at ON public.accounts;
CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. sellers - Add trigger and deleted_at column
-- ============================================================
-- Note: sellers table already has updated_at column (from 037_collection_infrastructure.sql)
-- but does NOT have a trigger to auto-update it. Adding trigger here.

-- Add deleted_at column for soft deletes
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create trigger using existing function from 001_auth_schema.sql
DROP TRIGGER IF EXISTS sellers_updated_at ON public.sellers;
CREATE TRIGGER sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
