---
phase: 20-virtualized-rendering
plan: 04
subsystem: ui
tags: [react, dexie, indexeddb, react-window, infinite-scroll]

# Dependency graph
requires:
  - phase: 20-02
    provides: Infinite loader integration with virtualized rows
  - phase: 20-03
    provides: Bookkeeping toolbar with filters and summaries
provides:
  - Pagination window state for synced records (hasMore/loadMore/totalCount)
  - Virtualized list wired to load additional rows on scroll
affects:
  - 21-export/import
  - virtualized-rendering verification

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pagination window state stored in sync hooks
    - Compound index query for descending record slices

key-files:
  created: []
  modified:
    - apps/web/src/hooks/sync/use-sync-records.ts
    - apps/web/src/components/bookkeeping/bookkeeping-content.tsx
    - apps/web/src/components/bookkeeping/virtualized-records-list.tsx
    - apps/web/src/components/bookkeeping/record-row.tsx

key-decisions:
  - "None - followed plan as specified"

patterns-established:
  - "Expose hasMore/loadMore/totalCount from sync hooks to support infinite scroll"

# Metrics
duration: 0 min
completed: 2026-01-25
---

# Phase 20 Plan 04: Infinite Scroll Pagination Wiring Summary

**Dexie-backed pagination window now drives infinite scroll with accurate total counts in the bookkeeping list.**

## Performance

- **Duration:** 0 min
- **Started:** 2026-01-25T00:00:11Z
- **Completed:** 2026-01-25T00:00:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added pagination window state (visible count, total, hasMore) to the sync records hook
- Wired bookkeeping list counts and infinite loader to the new pagination state
- Rendered skeleton loading rows while pagination requests are in flight

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pagination window state to useSyncRecords** - `5254279` (feat)
2. **Task 2: Wire pagination state into the virtualized list** - `7831e67` (feat)

**Plan metadata:** (docs commit created after summary)

## Files Created/Modified
- `apps/web/src/hooks/sync/use-sync-records.ts` - Adds PAGE_SIZE, visible window, count, and loadMore output
- `apps/web/src/components/bookkeeping/bookkeeping-content.tsx` - Passes pagination props and uses total counts
- `apps/web/src/components/bookkeeping/virtualized-records-list.tsx` - Uses totalCount and tracks loading rows
- `apps/web/src/components/bookkeeping/record-row.tsx` - Renders skeleton row for pagination fetches

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 20 gap closure complete; ready to proceed with Phase 21 planning.

---
*Phase: 20-virtualized-rendering*
*Completed: 2026-01-25*
