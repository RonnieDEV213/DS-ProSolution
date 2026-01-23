-- ============================================================
-- Migration 017: RBAC-based RLS for order_remarks/service_remarks
-- ============================================================
-- Purpose: Replace is_order_dept()/is_service_dept() with has_permission()
-- Safe cutover: create new policies first, verify, then drop old in 018
-- ============================================================

-- 1. Add org_id to accounts table (required for org_id_for_record)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS org_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::UUID;

-- Index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON public.accounts(org_id);

-- 2. Helper function: get org_id for a bookkeeping record
CREATE OR REPLACE FUNCTION public.org_id_for_record(check_record_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT a.org_id
  FROM public.bookkeeping_records br
  JOIN public.accounts a ON a.id = br.account_id
  WHERE br.id = check_record_id;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.org_id_for_record(UUID) TO authenticated;

-- ============================================================
-- 3. NEW RBAC POLICIES: order_remarks (idempotent)
-- ============================================================

-- VA SELECT (uses can_access_record for read)
DROP POLICY IF EXISTS "RBAC can view order_remarks" ON public.order_remarks;
CREATE POLICY "RBAC can view order_remarks"
ON public.order_remarks FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.read.order_remark')
  AND public.can_access_record(auth.uid(), record_id)
);

-- VA INSERT (uses can_write_record for write)
DROP POLICY IF EXISTS "RBAC can write order_remarks" ON public.order_remarks;
CREATE POLICY "RBAC can write order_remarks"
ON public.order_remarks FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.order_remark')
  AND public.can_write_record(auth.uid(), record_id)
);

-- VA UPDATE (uses can_write_record for write)
DROP POLICY IF EXISTS "RBAC can update order_remarks" ON public.order_remarks;
CREATE POLICY "RBAC can update order_remarks"
ON public.order_remarks FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.order_remark')
  AND public.can_write_record(auth.uid(), record_id)
)
WITH CHECK (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.order_remark')
  AND public.can_write_record(auth.uid(), record_id)
);

-- ============================================================
-- 4. NEW RBAC POLICIES: service_remarks (idempotent)
-- ============================================================

-- VA SELECT (uses can_access_record for read)
DROP POLICY IF EXISTS "RBAC can view service_remarks" ON public.service_remarks;
CREATE POLICY "RBAC can view service_remarks"
ON public.service_remarks FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.read.service_remark')
  AND public.can_access_record(auth.uid(), record_id)
);

-- VA INSERT (uses can_write_record for write)
DROP POLICY IF EXISTS "RBAC can write service_remarks" ON public.service_remarks;
CREATE POLICY "RBAC can write service_remarks"
ON public.service_remarks FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.service_remark')
  AND public.can_write_record(auth.uid(), record_id)
);

-- VA UPDATE (uses can_write_record for write)
DROP POLICY IF EXISTS "RBAC can update service_remarks" ON public.service_remarks;
CREATE POLICY "RBAC can update service_remarks"
ON public.service_remarks FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.service_remark')
  AND public.can_write_record(auth.uid(), record_id)
)
WITH CHECK (
  public.has_permission(auth.uid(), public.org_id_for_record(record_id), 'order_tracking.write.service_remark')
  AND public.can_write_record(auth.uid(), record_id)
);

-- NOTE: Old dept-based policies NOT dropped yet
-- Will be removed in migration 018 after verification
