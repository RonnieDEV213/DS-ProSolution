-- ============================================================
-- Migration 024: Ensure self-access RLS policy exists for dept roles
-- ============================================================

BEGIN;

ALTER TABLE public.membership_department_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Members can view own membership dept roles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Members can view own membership dept roles"
        ON public.membership_department_roles
        FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.id = membership_department_roles.membership_id
            AND m.user_id = auth.uid()
        ));
    $policy$;
  END IF;
END $$;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
