-- 008_migrate_overrides_to_dept_roles.sql
-- Convert TRUE bookkeeping overrides into Bookkeeping VA dept role assignments.
-- Leaves FALSE denies untouched. Safe to re-run.
-- Only clears overrides when the Bookkeeping VA role exists for the org.

-- Define target set: active VAs with TRUE overrides AND where Bookkeeping VA role exists
WITH target AS (
  SELECT m.id AS membership_id, m.user_id, dr.id AS role_id
  FROM public.memberships m
  JOIN public.user_permission_overrides upo
    ON upo.user_id = m.user_id
  JOIN public.department_roles dr
    ON dr.org_id = m.org_id
   AND dr.name = 'Bookkeeping VA'
  WHERE m.role = 'va'
    AND m.status = 'active'
    AND (
      upo.can_view_bookkeeping   IS TRUE OR
      upo.can_edit_bookkeeping   IS TRUE OR
      upo.can_export_bookkeeping IS TRUE
    )
)
-- 1) Assign Bookkeeping VA role
INSERT INTO public.membership_department_roles (membership_id, role_id)
SELECT membership_id, role_id FROM target
ON CONFLICT DO NOTHING;

-- 2) Clear TRUE overrides ONLY for users in the same target set
WITH target AS (
  SELECT m.user_id
  FROM public.memberships m
  JOIN public.user_permission_overrides upo
    ON upo.user_id = m.user_id
  JOIN public.department_roles dr
    ON dr.org_id = m.org_id
   AND dr.name = 'Bookkeeping VA'
  WHERE m.role = 'va'
    AND m.status = 'active'
    AND (
      upo.can_view_bookkeeping   IS TRUE OR
      upo.can_edit_bookkeeping   IS TRUE OR
      upo.can_export_bookkeeping IS TRUE
    )
)
UPDATE public.user_permission_overrides
SET
  can_view_bookkeeping   = CASE WHEN can_view_bookkeeping   IS TRUE THEN NULL ELSE can_view_bookkeeping END,
  can_edit_bookkeeping   = CASE WHEN can_edit_bookkeeping   IS TRUE THEN NULL ELSE can_edit_bookkeeping END,
  can_export_bookkeeping = CASE WHEN can_export_bookkeeping IS TRUE THEN NULL ELSE can_export_bookkeeping END
WHERE user_id IN (SELECT user_id FROM target);

-- Verification queries:
-- 1) Count migrated memberships
-- SELECT COUNT(*) FROM membership_department_roles mdr
-- JOIN department_roles dr ON dr.id = mdr.role_id
-- WHERE dr.name = 'Bookkeeping VA';
--
-- 2) Check remaining TRUE overrides for active VAs with Bookkeeping VA role available (should be 0)
-- SELECT COUNT(*) FROM user_permission_overrides upo
-- JOIN memberships m ON m.user_id = upo.user_id
-- JOIN department_roles dr ON dr.org_id = m.org_id AND dr.name = 'Bookkeeping VA'
-- WHERE m.role = 'va' AND m.status = 'active'
--   AND (upo.can_view_bookkeeping IS TRUE OR upo.can_edit_bookkeeping IS TRUE OR upo.can_export_bookkeeping IS TRUE);
