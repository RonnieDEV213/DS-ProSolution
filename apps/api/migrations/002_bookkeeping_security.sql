-- ============================================================
-- DS-ProSolution: Bookkeeping Security Migration
-- Run in Supabase SQL Editor
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bookkeeping_records_account_id
ON public.bookkeeping_records(account_id);

-- 1. Add client ownership to accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_client_user_id ON public.accounts(client_user_id);

-- 2. Create account_assignments table
CREATE TABLE IF NOT EXISTS public.account_assignments (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_write BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_assignments_user_id ON public.account_assignments(user_id);

-- 3. Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookkeeping_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: account_assignments
-- ============================================================

DROP POLICY IF EXISTS "Admin can view all assignments" ON public.account_assignments;
CREATE POLICY "Admin can view all assignments"
ON public.account_assignments FOR SELECT TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "User can view own assignments" ON public.account_assignments;
CREATE POLICY "User can view own assignments"
ON public.account_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can create assignments" ON public.account_assignments;
CREATE POLICY "Admin can create assignments"
ON public.account_assignments FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin can update assignments" ON public.account_assignments;
CREATE POLICY "Admin can update assignments"
ON public.account_assignments FOR UPDATE TO authenticated
USING ((SELECT public.is_admin(auth.uid())))
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin can delete assignments" ON public.account_assignments;
CREATE POLICY "Admin can delete assignments"
ON public.account_assignments FOR DELETE TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- ============================================================
-- RLS POLICIES: accounts
-- ============================================================

DROP POLICY IF EXISTS "Admin can view all accounts" ON public.accounts;
CREATE POLICY "Admin can view all accounts"
ON public.accounts FOR SELECT TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Client can view own accounts" ON public.accounts;
CREATE POLICY "Client can view own accounts"
ON public.accounts FOR SELECT TO authenticated
USING (client_user_id = auth.uid());

DROP POLICY IF EXISTS "VA can view assigned accounts" ON public.accounts;
CREATE POLICY "VA can view assigned accounts"
ON public.accounts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = accounts.id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin can create accounts" ON public.accounts;
CREATE POLICY "Admin can create accounts"
ON public.accounts FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin can update accounts" ON public.accounts;
CREATE POLICY "Admin can update accounts"
ON public.accounts FOR UPDATE TO authenticated
USING ((SELECT public.is_admin(auth.uid())))
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Admin can delete accounts" ON public.accounts;
CREATE POLICY "Admin can delete accounts"
ON public.accounts FOR DELETE TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

-- ============================================================
-- RLS POLICIES: bookkeeping_records
-- ============================================================

DROP POLICY IF EXISTS "Admin can view all records" ON public.bookkeeping_records;
CREATE POLICY "Admin can view all records"
ON public.bookkeeping_records FOR SELECT TO authenticated
USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Client can view own records" ON public.bookkeeping_records;
CREATE POLICY "Client can view own records"
ON public.bookkeeping_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = bookkeeping_records.account_id
    AND accounts.client_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "VA can view assigned records" ON public.bookkeeping_records;
CREATE POLICY "VA can view assigned records"
ON public.bookkeeping_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin can create records" ON public.bookkeeping_records;
CREATE POLICY "Admin can create records"
ON public.bookkeeping_records FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "VA can create assigned records" ON public.bookkeeping_records;
CREATE POLICY "VA can create assigned records"
ON public.bookkeeping_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
    AND can_write = true
  )
);

DROP POLICY IF EXISTS "Admin can update records" ON public.bookkeeping_records;
CREATE POLICY "Admin can update records"
ON public.bookkeeping_records FOR UPDATE TO authenticated
USING ((SELECT public.is_admin(auth.uid())))
WITH CHECK ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "VA can update assigned records" ON public.bookkeeping_records;
CREATE POLICY "VA can update assigned records"
ON public.bookkeeping_records FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
    AND can_write = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.account_assignments
    WHERE account_id = bookkeeping_records.account_id
    AND user_id = auth.uid()
    AND can_write = true
  )
);

DROP POLICY IF EXISTS "Admin can delete records" ON public.bookkeeping_records;
CREATE POLICY "Admin can delete records"
ON public.bookkeeping_records FOR DELETE TO authenticated
USING ((SELECT public.is_admin(auth.uid())));
