-- ============================================================
-- Migration 018: Drop legacy dept-based RLS policies and functions
-- ============================================================
-- Purpose: Remove is_order_dept()/is_service_dept() enforcement
-- Run AFTER verifying Stage B (RBAC policies) works correctly
-- ============================================================

-- 1. Drop old dept-based policies on order_remarks
DROP POLICY IF EXISTS "Order dept can view order_remarks" ON public.order_remarks;
DROP POLICY IF EXISTS "Order dept can write order_remarks" ON public.order_remarks;
DROP POLICY IF EXISTS "Order dept can update order_remarks" ON public.order_remarks;

-- 2. Drop old dept-based policies on service_remarks
DROP POLICY IF EXISTS "Service dept can view service_remarks" ON public.service_remarks;
DROP POLICY IF EXISTS "Service dept can write service_remarks" ON public.service_remarks;
DROP POLICY IF EXISTS "Service dept can update service_remarks" ON public.service_remarks;

-- 3. Drop legacy dept check functions
DROP FUNCTION IF EXISTS public.is_order_dept(UUID);
DROP FUNCTION IF EXISTS public.is_service_dept(UUID);

-- ============================================================
-- Verification Queries (run after migration)
-- ============================================================
--
-- 1. Confirm old policies are gone:
--    SELECT tablename, policyname
--    FROM pg_policies
--    WHERE tablename IN ('order_remarks', 'service_remarks')
--      AND policyname LIKE '%dept%';
--    -- Should return 0 rows
--
-- 2. Confirm RBAC policies exist:
--    SELECT tablename, policyname
--    FROM pg_policies
--    WHERE tablename IN ('order_remarks', 'service_remarks')
--      AND policyname LIKE 'RBAC%';
--    -- Should return 6 rows (3 per table)
--
-- 3. Confirm functions are dropped:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('is_order_dept', 'is_service_dept');
--    -- Should return 0 rows
-- ============================================================
