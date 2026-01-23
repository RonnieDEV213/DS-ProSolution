-- ============================================================
-- DS-ProSolution: Bookkeeping Redesign Migration
-- Depends on: 001_auth_schema.sql (is_admin function)
-- Run in Supabase SQL Editor
-- ============================================================

-- MVP org ID (matches 001_auth_schema.sql)
-- a0000000-0000-0000-0000-000000000001

-- 1. Rename existing columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookkeeping_records' AND column_name='cogs_cents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookkeeping_records' AND column_name='amazon_price_cents'
  ) THEN
    ALTER TABLE public.bookkeeping_records RENAME COLUMN cogs_cents TO amazon_price_cents;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookkeeping_records' AND column_name='tax_paid_cents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bookkeeping_records' AND column_name='amazon_tax_cents'
  ) THEN
    ALTER TABLE public.bookkeeping_records RENAME COLUMN tax_paid_cents TO amazon_tax_cents;
  END IF;
END $$;

-- 2. Add new column
ALTER TABLE public.bookkeeping_records
  ADD COLUMN IF NOT EXISTS amazon_shipping_cents INTEGER DEFAULT 0;

-- 3. Create order_remarks table (Order VA + Admin access)
CREATE TABLE IF NOT EXISTS public.order_remarks (
  record_id UUID PRIMARY KEY REFERENCES public.bookkeeping_records(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 4. Create service_remarks table (Service VA + Admin access)
CREATE TABLE IF NOT EXISTS public.service_remarks (
  record_id UUID PRIMARY KEY REFERENCES public.bookkeeping_records(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 4.1 Create one shared trigger function
CREATE OR REPLACE FUNCTION public.touch_remark_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

--4.2 Attach triggers to both tables
DROP TRIGGER IF EXISTS tr_touch_order_remarks ON public.order_remarks;
CREATE TRIGGER tr_touch_order_remarks
BEFORE INSERT OR UPDATE ON public.order_remarks
FOR EACH ROW EXECUTE FUNCTION public.touch_remark_audit_fields();

DROP TRIGGER IF EXISTS tr_touch_service_remarks ON public.service_remarks;
CREATE TRIGGER tr_touch_service_remarks
BEFORE INSERT OR UPDATE ON public.service_remarks
FOR EACH ROW EXECUTE FUNCTION public.touch_remark_audit_fields();

-- 5. Migrate existing remarks to order_remarks (idempotent)
INSERT INTO public.order_remarks (record_id, content)
SELECT id, remarks FROM public.bookkeeping_records WHERE remarks IS NOT NULL
ON CONFLICT (record_id) DO NOTHING;

-- 6. Drop old remarks column (after migration verified)
-- ALTER TABLE public.bookkeeping_records DROP COLUMN remarks;

-- ============================================================
-- 7. Helper functions for department checks
-- Note: 'general' dept does NOT have access to either remark type
-- All functions use SET search_path = '' for security
-- Org-scoped using MVP default org ID
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_order_dept(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id
    AND org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
    AND department = 'ordering'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_service_dept(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = check_user_id
    AND org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
    AND department IN ('returns', 'cs')
  );
END;
$$;

-- Helper to check if user can access the parent bookkeeping record
CREATE OR REPLACE FUNCTION public.can_access_record(check_user_id UUID, check_record_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  -- Admin can access all
  IF (SELECT public.is_admin(check_user_id)) THEN
    RETURN TRUE;
  END IF;

  -- Check via account_assignments
  RETURN EXISTS (
    SELECT 1 FROM public.bookkeeping_records br
    JOIN public.account_assignments aa ON aa.account_id = br.account_id
    WHERE br.id = check_record_id
    AND aa.user_id = check_user_id
  );
END;
$$;

-- Helper to check if user has write access to the parent record
CREATE OR REPLACE FUNCTION public.can_write_record(check_user_id UUID, check_record_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  -- Admin can write all
  IF (SELECT public.is_admin(check_user_id)) THEN
    RETURN TRUE;
  END IF;

  -- Check via account_assignments with can_write = true
  RETURN EXISTS (
    SELECT 1 FROM public.bookkeeping_records br
    JOIN public.account_assignments aa ON aa.account_id = br.account_id
    WHERE br.id = check_record_id
    AND aa.user_id = check_user_id
    AND aa.can_write = TRUE
  );
END;
$$;

-- ============================================================
-- 8. Trigger to enforce return_label_cost = 0 when status = REFUND_NO_RETURN
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_refund_no_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'REFUND_NO_RETURN' THEN
    NEW.return_label_cost_cents := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_refund_no_return ON public.bookkeeping_records;
CREATE TRIGGER tr_enforce_refund_no_return
  BEFORE INSERT OR UPDATE ON public.bookkeeping_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_refund_no_return();

-- ============================================================
-- 9. Enable RLS on new tables
-- ============================================================

ALTER TABLE public.order_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_remarks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_remarks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_remarks FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS Policies for order_remarks
-- SELECT: dept access + record access
-- INSERT/UPDATE: dept access + record WRITE access (can_write = true)
-- DELETE: admin only
-- ============================================================

-- Admin SELECT
DROP POLICY IF EXISTS "Admin can view order_remarks" ON public.order_remarks;
CREATE POLICY "Admin can view order_remarks"
ON public.order_remarks FOR SELECT TO authenticated
USING (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_access_record(auth.uid(), record_id))
);

-- Order dept SELECT
DROP POLICY IF EXISTS "Order dept can view order_remarks" ON public.order_remarks;
CREATE POLICY "Order dept can view order_remarks"
ON public.order_remarks FOR SELECT TO authenticated
USING (
  (SELECT public.is_order_dept(auth.uid()))
  AND (SELECT public.can_access_record(auth.uid(), record_id))
);

-- Admin INSERT (with write check)
DROP POLICY IF EXISTS "Admin can write order_remarks" ON public.order_remarks;
CREATE POLICY "Admin can write order_remarks"
ON public.order_remarks FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Admin UPDATE (with write check)
DROP POLICY IF EXISTS "Admin can update order_remarks" ON public.order_remarks;
CREATE POLICY "Admin can update order_remarks"
ON public.order_remarks FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
)
WITH CHECK (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Order dept INSERT (with write check)
DROP POLICY IF EXISTS "Order dept can write order_remarks" ON public.order_remarks;
CREATE POLICY "Order dept can write order_remarks"
ON public.order_remarks FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_order_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Order dept UPDATE (with write check)
DROP POLICY IF EXISTS "Order dept can update order_remarks" ON public.order_remarks;
CREATE POLICY "Order dept can update order_remarks"
ON public.order_remarks FOR UPDATE TO authenticated
USING (
  (SELECT public.is_order_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
)
WITH CHECK (
  (SELECT public.is_order_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Admin DELETE only
DROP POLICY IF EXISTS "Admin can delete order_remarks" ON public.order_remarks;
CREATE POLICY "Admin can delete order_remarks"
ON public.order_remarks FOR DELETE TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- ============================================================
-- 11. RLS Policies for service_remarks (same pattern)
-- ============================================================

-- Admin SELECT
DROP POLICY IF EXISTS "Admin can view service_remarks" ON public.service_remarks;
CREATE POLICY "Admin can view service_remarks"
ON public.service_remarks FOR SELECT TO authenticated
USING (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_access_record(auth.uid(), record_id))
);

-- Service dept SELECT
DROP POLICY IF EXISTS "Service dept can view service_remarks" ON public.service_remarks;
CREATE POLICY "Service dept can view service_remarks"
ON public.service_remarks FOR SELECT TO authenticated
USING (
  (SELECT public.is_service_dept(auth.uid()))
  AND (SELECT public.can_access_record(auth.uid(), record_id))
);

-- Admin INSERT (with write check)
DROP POLICY IF EXISTS "Admin can write service_remarks" ON public.service_remarks;
CREATE POLICY "Admin can write service_remarks"
ON public.service_remarks FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Admin UPDATE (with write check)
DROP POLICY IF EXISTS "Admin can update service_remarks" ON public.service_remarks;
CREATE POLICY "Admin can update service_remarks"
ON public.service_remarks FOR UPDATE TO authenticated
USING (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
)
WITH CHECK (
  (SELECT public.is_admin(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Service dept INSERT (with write check)
DROP POLICY IF EXISTS "Service dept can write service_remarks" ON public.service_remarks;
CREATE POLICY "Service dept can write service_remarks"
ON public.service_remarks FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_service_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Service dept UPDATE (with write check)
DROP POLICY IF EXISTS "Service dept can update service_remarks" ON public.service_remarks;
CREATE POLICY "Service dept can update service_remarks"
ON public.service_remarks FOR UPDATE TO authenticated
USING (
  (SELECT public.is_service_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
)
WITH CHECK (
  (SELECT public.is_service_dept(auth.uid()))
  AND (SELECT public.can_write_record(auth.uid(), record_id))
);

-- Admin DELETE only
DROP POLICY IF EXISTS "Admin can delete service_remarks" ON public.service_remarks;
CREATE POLICY "Admin can delete service_remarks"
ON public.service_remarks FOR DELETE TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- ============================================================
-- 12. GRANT privileges for new tables
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.order_remarks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_remarks TO authenticated;
-- DELETE only via admin policy, but grant needed for RLS to work
GRANT DELETE ON public.order_remarks TO authenticated;
GRANT DELETE ON public.service_remarks TO authenticated;
