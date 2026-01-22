---
phase: 11-collection-bug-fixes-polish
plan: 01
subsystem: ui, api
tags: [polling, audit-log, progress-bar, react-hooks]

# Dependency graph
requires:
  - phase: 08-ebay-seller-search
    provides: Collection run infrastructure and audit logging
  - phase: 09-collection-ui-real-time-progress
    provides: Progress polling hook and UI components
provides:
  - Faster polling (500ms) for responsive progress updates
  - Accurate audit log replay for bulk operations
  - Verified progress persistence on page refresh
affects: [collection-ui, seller-management, history-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk operation audit parsing via new_value/old_value JSON"

key-files:
  created: []
  modified:
    - apps/web/src/hooks/use-collection-polling.ts
    - apps/api/src/app/services/collection.py

key-decisions:
  - "500ms polling interval acceptable for lightweight single-row progress endpoint"
  - "Parse new_value JSON for bulk adds, old_value JSON for bulk removes"

patterns-established:
  - "Audit log replay handles both single and bulk operations"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 11 Plan 01: Progress & History Fixes Summary

**Reduced polling to 500ms and fixed audit log replay to show accurate seller counts for bulk operations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-22T16:16:46Z
- **Completed:** 2026-01-22T16:19:27Z
- **Tasks:** 3 (2 code changes, 1 verification)
- **Files modified:** 2

## Accomplishments
- Progress bar updates within 500ms during active collection (halved from 1s)
- History "sellers at this point" shows complete seller list for bulk operations
- Verified progress persistence on page refresh works correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Reduce polling interval during active collection** - `e6e84bd` (perf)
2. **Task 2: Fix audit log replay for bulk operations** - `bbf5b7b` (fix)
3. **Task 3: Verify progress persistence on refresh** - No commit (verification only)

## Files Created/Modified
- `apps/web/src/hooks/use-collection-polling.ts` - Changed polling interval default from 1000ms to 500ms
- `apps/api/src/app/services/collection.py` - Added new_value/affected_count parsing in get_sellers_at_log for bulk adds/removes

## Decisions Made
- 500ms polling interval is acceptable because the progress endpoint only reads a single collection_runs row
- Also fixed bulk remove replay (not just adds) since it uses the same pattern with old_value

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added bulk remove handling to audit log replay**
- **Found during:** Task 2 (Fix audit log replay for bulk operations)
- **Issue:** Plan only mentioned bulk adds, but bulk removes also store names in old_value JSON
- **Fix:** Added same parsing logic for remove action using old_value field
- **Files modified:** apps/api/src/app/services/collection.py
- **Verification:** Code handles both add and remove with affected_count > 1
- **Committed in:** bbf5b7b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix ensures complete bulk operation handling. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Progress polling is now more responsive (500ms)
- Audit log replay correctly handles all operation types
- Ready for remaining Phase 11 plans

---
*Phase: 11-collection-bug-fixes-polish*
*Completed: 2026-01-22*
