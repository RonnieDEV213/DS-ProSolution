-- ============================================================
-- DS-ProSolution: Organization Owner Governance
-- Adds org ownership concept - ownership must be transferred explicitly
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- 1. Create orgs table
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Organization',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_owner_user_id ON public.orgs(owner_user_id);

-- 2. Backfill default org with fail-fast safety
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Skip if org already exists
  IF EXISTS (SELECT 1 FROM public.orgs WHERE id = 'a0000000-0000-0000-0000-000000000001'::UUID) THEN
    RETURN;
  END IF;

  -- Find earliest active admin (order by id as fallback if created_at is null)
  SELECT user_id INTO v_owner_id
  FROM public.memberships
  WHERE org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
    AND role = 'admin' AND status = 'active'
  ORDER BY COALESCE(created_at, '1970-01-01'::TIMESTAMPTZ), id
  LIMIT 1;

  -- Fallback to any admin (pending or otherwise)
  IF v_owner_id IS NULL THEN
    SELECT user_id INTO v_owner_id
    FROM public.memberships
    WHERE org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
      AND role = 'admin'
    ORDER BY COALESCE(created_at, '1970-01-01'::TIMESTAMPTZ), id
    LIMIT 1;
  END IF;

  -- Fail fast if no admin at all
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create orgs row: no admin found for default org. Create at least one admin first.';
  END IF;

  INSERT INTO public.orgs (id, name, owner_user_id)
  VALUES ('a0000000-0000-0000-0000-000000000001'::UUID, 'Default Organization', v_owner_id);
END;
$$;

-- 3. Add FK constraint safely (NOT VALID then VALIDATE)
ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS fk_memberships_org_id;

ALTER TABLE public.memberships
  ADD CONSTRAINT fk_memberships_org_id
  FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE RESTRICT
  NOT VALID;

-- Validate (will fail if any orphan org_ids exist)
ALTER TABLE public.memberships VALIDATE CONSTRAINT fk_memberships_org_id;

-- 4. DB trigger to protect owner's membership
CREATE OR REPLACE FUNCTION public.check_owner_membership_protected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  org_owner_id UUID;
BEGIN
  -- Serialize concurrent owner operations per org (prevent race during transfer + demotion)
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(OLD.org_id::text || '_owner'));

  SELECT owner_user_id INTO org_owner_id
  FROM public.orgs WHERE id = OLD.org_id;

  -- If target is the org owner
  IF OLD.user_id = org_owner_id THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'OWNER_PROTECTED: Cannot delete the organization owner membership'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      -- Block if role changed from admin OR status changed from active
      IF NEW.role <> 'admin' OR NEW.status <> 'active' THEN
        RAISE EXCEPTION 'OWNER_PROTECTED: Cannot demote or deactivate the organization owner'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_owner_membership_update ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_protect_owner_membership_update
  AFTER UPDATE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND OLD.status = 'active'
    AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status))
  EXECUTE FUNCTION public.check_owner_membership_protected();

DROP TRIGGER IF EXISTS trg_protect_owner_membership_delete ON public.memberships;
CREATE CONSTRAINT TRIGGER trg_protect_owner_membership_delete
  AFTER DELETE ON public.memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND OLD.status = 'active')
  EXECUTE FUNCTION public.check_owner_membership_protected();

-- 5. RLS policies (optional - API uses service role which bypasses RLS)
-- Note: API uses service role key, so RLS is bypassed for backend calls.
-- These policies only matter if frontend ever queries orgs directly with anon key.
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- Minimal policy: any authenticated user in the org can read
DROP POLICY IF EXISTS "Members can view their org" ON public.orgs;
CREATE POLICY "Members can view their org" ON public.orgs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.org_id = orgs.id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
  ));

-- Owner update handled via API, not direct client writes
