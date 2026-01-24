-- Migration: 048_sync_purge_job.sql
-- Purpose: Create pg_cron job to permanently delete old soft-deleted records
-- Phase: 15-server-storage-foundation, Plan: 01
-- Depends on: 046_sync_infrastructure_columns.sql (deleted_at column)
--
-- Soft delete retention policy (per CONTEXT.md):
-- - Records with deleted_at > 30 days ago are permanently purged
-- - Runs daily at 3:00 AM UTC (off-peak hours)
-- - No archive before purge (30 days is sufficient recovery window)

-- ============================================================
-- 1. Enable pg_cron extension
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================
-- 2. Create purge function
-- ============================================================
-- Permanently deletes records that were soft-deleted more than 30 days ago.
-- Uses SET search_path = '' for security (codebase convention).

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Permanently delete bookkeeping records soft-deleted > 30 days ago
  DELETE FROM public.bookkeeping_records
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  -- Permanently delete accounts soft-deleted > 30 days ago
  DELETE FROM public.accounts
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  -- Permanently delete sellers soft-deleted > 30 days ago
  DELETE FROM public.sellers
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================
-- 3. Schedule daily purge job
-- ============================================================
-- Schedule: 3:00 AM UTC daily (off-peak per CONTEXT.md)
-- pg_cron uses UTC timezone on Supabase.
--
-- Idempotency: Unschedule existing job first if it exists.

DO $$
BEGIN
  -- Remove existing job if present (idempotent)
  PERFORM cron.unschedule('purge-soft-deleted-records')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-soft-deleted-records'
  );
EXCEPTION
  WHEN undefined_table THEN
    -- cron.job table doesn't exist yet, skip unschedule
    NULL;
  WHEN undefined_function THEN
    -- cron.unschedule doesn't exist yet, skip unschedule
    NULL;
END;
$$;

-- Schedule the purge job
SELECT cron.schedule(
  'purge-soft-deleted-records',  -- job name
  '0 3 * * *',                   -- 3:00 AM UTC daily
  $$ SELECT public.purge_soft_deleted_records(); $$
);
