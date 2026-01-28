-- Migration: 053_bulk_delete_sellers_rpc.sql
-- Purpose: RPC function for atomic bulk seller deletion
-- Replaces 64 batched HTTP requests with a single database call
--
-- Uses SECURITY INVOKER so the function runs as the calling role
-- (service_role via the API), which has full RLS access on both
-- sellers and seller_audit_log tables.

DROP FUNCTION IF EXISTS public.bulk_delete_sellers;

CREATE OR REPLACE FUNCTION public.bulk_delete_sellers(
  p_org_id UUID,
  p_seller_ids UUID[],
  p_user_id UUID,
  p_source TEXT DEFAULT 'manual'
)
RETURNS TABLE (deleted_count INT, deleted_names TEXT[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted_count INT;
  v_deleted_names TEXT[];
  v_seller_count INT;
  v_summary TEXT;
BEGIN
  -- Capture display_name values before delete, then delete atomically
  WITH to_delete AS (
    DELETE FROM sellers
    WHERE id = ANY(p_seller_ids)
      AND org_id = p_org_id
    RETURNING id, display_name
  )
  SELECT COUNT(*)::INT, COALESCE(ARRAY_AGG(display_name), ARRAY[]::TEXT[])
  INTO v_deleted_count, v_deleted_names
  FROM to_delete;

  -- Handle case where nothing was deleted
  IF v_deleted_count = 0 THEN
    RETURN QUERY SELECT 0::INT, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- Get remaining seller count for snapshot
  SELECT COUNT(*)::INT INTO v_seller_count
  FROM sellers
  WHERE org_id = p_org_id;

  -- Build summary string matching existing audit log format
  IF v_deleted_count = 1 THEN
    v_summary := v_deleted_names[1];
  ELSE
    v_summary := v_deleted_names[1] || ' (+' || (v_deleted_count - 1) || ' more)';
  END IF;

  -- Insert single audit log entry (matches schema from migration 038/045)
  INSERT INTO seller_audit_log (
    org_id, action, seller_id, seller_name,
    old_value, new_value,
    source, source_run_id, source_criteria,
    user_id, affected_count, seller_count_snapshot
  ) VALUES (
    p_org_id, 'remove', NULL, v_summary,
    jsonb_build_object('names', to_jsonb(v_deleted_names)), NULL,
    p_source, NULL, NULL,
    p_user_id, v_deleted_count, v_seller_count
  );

  RETURN QUERY SELECT v_deleted_count, v_deleted_names;
END;
$$;

-- Only service_role calls this (via API), not authenticated users directly
GRANT EXECUTE ON FUNCTION public.bulk_delete_sellers TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
