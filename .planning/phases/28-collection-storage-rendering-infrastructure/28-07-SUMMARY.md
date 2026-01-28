---
phase: 28-collection-storage-rendering-infrastructure
plan: 07
subsystem: database
tags: [rls, supabase, sellers, authentication, policy, migration]

# Dependency graph
requires:
  - phase: 28-01
    provides: "sellerApi, getAccessToken export, sync sellers endpoint"
  - phase: 19-sync-protocol
    provides: "useSyncSellers hook using user-scoped Supabase client"
provides:
  - "Authenticated user SELECT policy on sellers table"
  - "Org-scoped RLS allowing /sync/sellers to return seller rows"
affects: [collection-ui, sellers-grid, sync-sellers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Authenticated RLS SELECT policy scoped via memberships table org_id"

key-files:
  created:
    - "apps/api/migrations/052_sellers_authenticated_rls.sql"
  modified: []

key-decisions:
  - "Policy scoped to org_id via memberships WHERE user_id = auth.uid() AND status = 'active'"
  - "Only SELECT policy added (mutations go through service_role API client)"
  - "Existing service_role_sellers policy untouched"
  - "NULL updated_at backfill added to fix cursor pagination edge case"

patterns-established:
  - "Authenticated user RLS SELECT policy via memberships org_id subquery"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 28 Plan 07: Authenticated RLS SELECT Policy for Sellers Table Summary

**RLS migration adding org-scoped authenticated user SELECT policy on sellers table to unblock /sync/sellers endpoint and SellersGrid**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27
- **Completed:** 2026-01-27
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files created:** 1

## Accomplishments
- Sellers grid now displays all ~4,700 sellers (previously showed 0 due to missing RLS policy)
- /sync/sellers endpoint returns org-scoped seller rows for authenticated users
- Existing service_role_sellers policy remains intact for background worker operations
- NULL updated_at edge case fixed with backfill migration for cursor pagination compatibility
- Human verified: migration applied, sellers grid loads correctly with search and filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration adding authenticated user SELECT policy on sellers table** - `2f176a5` (feat) + `59fa339` (fix: NULL updated_at backfill)
2. **Task 2: Human verification checkpoint** - User approved: sellers load correctly in grid

## Files Created/Modified
- `apps/api/migrations/052_sellers_authenticated_rls.sql` - RLS policy: authenticated_select_sellers on sellers table, scoped to org_id via memberships subquery

## Decisions Made
- **SELECT only:** Only a SELECT policy was added. INSERT/UPDATE/DELETE operations go through the API service_role client, not the user-scoped client, so no mutation policies are needed.
- **Org scoping via memberships:** Policy uses `org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')` matching the established pattern from migrations 036/049.
- **Idempotent migration:** Uses `DROP POLICY IF EXISTS` before `CREATE POLICY` for safe re-runs.
- **NULL updated_at fix:** Commit 59fa339 added a backfill for NULL updated_at values and a COALESCE in cursor pagination to prevent sellers from being skipped during sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NULL updated_at breaking cursor pagination**
- **Found during:** Task 1 checkpoint verification
- **Issue:** Some sellers had NULL updated_at values, causing cursor pagination in /sync/sellers to skip rows
- **Fix:** Added backfill UPDATE + COALESCE in pagination query
- **Files modified:** apps/api/migrations/052_sellers_authenticated_rls.sql
- **Commit:** 59fa339

## Issues Encountered

None beyond the NULL updated_at edge case (resolved in-plan).

## User Setup Required

Migration must be applied manually via Supabase Dashboard SQL Editor (already done during human verification checkpoint).

## Gap Closure

This was the final gap closure plan for Phase 28. The sellers RLS policy was the root cause of the "no sellers" bug in the SellersGrid. With this migration applied, all Phase 28 UAT tests that depend on seller data (tests 2-8, 12) are unblocked.

## Next Phase Readiness
- All 7 plans in Phase 28 are now complete (6 original + 1 gap closure)
- Sellers grid fully functional with ~4,700 sellers
- All sync, persistence, and rendering infrastructure operational
- Ready for Phase 28 final verification

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
