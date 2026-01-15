-- ============================================================
-- Migration 026: Fix membership_department_roles RLS for suspended users
-- ============================================================
-- Problem: Policy "Members can view own membership dept roles" does not
-- check membership status, allowing suspended users to query their rows.
--
-- Fix: Use ALTER POLICY to patch the existing policy (idempotent).
-- Also tighten admin policies from PUBLIC to authenticated.
--
-- Idempotent: Each ALTER POLICY is wrapped in a check for policy existence.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Patch member self-access policy to require status='active'
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Members can view own membership dept roles'
  ) THEN
    EXECUTE $policy$
      ALTER POLICY "Members can view own membership dept roles"
        ON public.membership_department_roles
        TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.id = membership_department_roles.membership_id
            AND m.user_id = auth.uid()
            AND m.status = 'active'
        ))
    $policy$;
  END IF;
END $$;

-- ============================================================
-- 2. Tighten admin policies from PUBLIC to authenticated
-- ============================================================
-- (does not change qual/with_check, just restricts to authenticated role)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Admins can view membership dept roles'
  ) THEN
    EXECUTE $policy$
      ALTER POLICY "Admins can view membership dept roles"
        ON public.membership_department_roles
        TO authenticated
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Admins can manage membership dept roles'
  ) THEN
    EXECUTE $policy$
      ALTER POLICY "Admins can manage membership dept roles"
        ON public.membership_department_roles
        TO authenticated
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Admins can update membership dept roles'
  ) THEN
    EXECUTE $policy$
      ALTER POLICY "Admins can update membership dept roles"
        ON public.membership_department_roles
        TO authenticated
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'membership_department_roles'
      AND policyname = 'Admins can delete membership dept roles'
  ) THEN
    EXECUTE $policy$
      ALTER POLICY "Admins can delete membership dept roles"
        ON public.membership_department_roles
        TO authenticated
    $policy$;
  END IF;
END $$;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verification Queries (run before and after migration)
-- ============================================================
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='membership_department_roles'
-- ORDER BY cmd, policyname;
--
-- Expected after migration:
-- - "Members can view own membership dept roles" qual contains 'm.status = ''active'''
-- - All policies have roles = '{authenticated}'
--
-- ============================================================
