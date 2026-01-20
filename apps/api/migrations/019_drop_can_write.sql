-- ============================================================
-- Migration 019: Remove can_write dependency from RLS
-- ============================================================
-- Purpose: Assignment = write access (RBAC controls field permissions)
-- Run AFTER Stage C (018) is verified working
-- ============================================================

-- 1. Update can_write_record() to check assignment only (no can_write flag)
CREATE OR REPLACE FUNCTION public.can_write_record(check_user_id UUID, check_record_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
BEGIN
  -- Admin can write all
  IF (SELECT public.is_admin(check_user_id)) THEN
    RETURN TRUE;
  END IF;

  -- Check via account_assignments (assignment = write access)
  RETURN EXISTS (
    SELECT 1 FROM public.bookkeeping_records br
    JOIN public.account_assignments aa ON aa.account_id = br.account_id
    WHERE br.id = check_record_id
    AND aa.user_id = check_user_id
  );
END;
$$;

-- 2. Update bookkeeping_records INSERT policy (remove can_write check)
DROP POLICY IF EXISTS "VA can create assigned records" ON public.bookkeeping_records;
CREATE POLICY "VA can create assigned records"
ON public.bookkeeping_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
  )
);

-- 3. Update bookkeeping_records UPDATE policy (remove can_write check)
DROP POLICY IF EXISTS "VA can update assigned records" ON public.bookkeeping_records;
CREATE POLICY "VA can update assigned records"
ON public.bookkeeping_records FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
  )
);
