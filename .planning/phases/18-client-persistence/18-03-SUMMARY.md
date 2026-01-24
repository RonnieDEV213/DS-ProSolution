---
phase: 18-client-persistence
plan: 03
subsystem: ui
tags: [dexie, indexeddb, react-hooks, cache-first, prefetch]

# Dependency graph
requires:
  - phase: 18-02
    provides: useSyncRecords hook, usePrefetchOnScroll hook
provides:
  - Cache-first bookkeeping UI loading from IndexedDB
  - Prefetch sentinel wiring for scroll-triggered resync
  - Client-side computed fields (profit, earnings, COGS)
affects: [19-offline-ux, 20-virtualized-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cache-first pattern (IndexedDB -> UI, then background sync)
    - Client-side computed fields from raw cached data
    - Sentinel element for scroll-triggered actions

key-files:
  created: []
  modified:
    - apps/web/src/components/bookkeeping/bookkeeping-content.tsx
    - apps/web/src/components/bookkeeping/records-table.tsx

key-decisions:
  - "Cast IndexedDB status string to BookkeepingStatus type for type safety"
  - "Compute profit/earnings/COGS client-side from raw cached data"
  - "hasNextPage=false since useSyncRecords loads all records (no pagination)"

patterns-established:
  - "Cache-first hook usage: useSyncRecords replaces server-only fetch"
  - "Type casting for IndexedDB schema strings to typed enums"
  - "Prefetch sentinel placement at end of table component"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 18 Plan 03: Cache-First Wiring Summary

**Bookkeeping UI now loads records from IndexedDB cache instantly, with background server sync and prefetch sentinel for scroll-triggered resync**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T07:54:08Z
- **Completed:** 2026-01-24T07:57:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Bookkeeping page loads records from IndexedDB cache before network
- Background sync updates cached data after initial display
- Client-side computed fields (profit, earnings, COGS) calculated from raw data
- Prefetch sentinel wired to trigger resync when user scrolls to bottom

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire useSyncRecords into bookkeeping-content.tsx** - `8155900` (feat)
2. **Task 2: Wire usePrefetchOnScroll into records-table.tsx** - `ffe2127` (feat)

## Files Created/Modified
- `apps/web/src/components/bookkeeping/bookkeeping-content.tsx` - Replaced useRecordsInfinite with useSyncRecords, added computed fields, added prefetch hook
- `apps/web/src/components/bookkeeping/records-table.tsx` - Added prefetchSentinelRef prop and sentinel div element

## Decisions Made
- **Cast status to BookkeepingStatus:** IndexedDB schema stores status as string, but API type expects BookkeepingStatus enum. Added explicit cast for type safety.
- **Client-side computed fields:** Server sends raw data (sale_price_cents, ebay_fees_cents, etc.), client computes derived fields (earnings_net_cents, cogs_total_cents, profit_cents).
- **hasNextPage=false for prefetch:** useSyncRecords loads all records for an account (no pagination), so prefetch triggers resync rather than page fetch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added type cast for IndexedDB status field**
- **Found during:** Task 1 (Wire useSyncRecords)
- **Issue:** TypeScript error - IndexedDB BookkeepingRecord has status: string, but API type expects BookkeepingStatus
- **Fix:** Added `status: item.status as BookkeepingStatus` cast in computed records map
- **Files modified:** apps/web/src/components/bookkeeping/bookkeeping-content.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 8155900 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Type casting necessary for IndexedDB/API type compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cache-first loading working in bookkeeping UI
- Gaps CACH-04 and CACH-06 from 18-VERIFICATION.md closed
- Ready for Phase 19 (Offline UX) to add offline indicators and sync status UI
- Phase 20 (Virtualized Rendering) can enhance prefetch with true pagination

---
*Phase: 18-client-persistence*
*Completed: 2026-01-24*
