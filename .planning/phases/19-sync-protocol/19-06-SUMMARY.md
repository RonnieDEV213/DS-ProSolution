---
phase: 19-sync-protocol
plan: 06
subsystem: database
tags: [indexeddb, sync, conflict-detection, api]

# Dependency graph
requires:
  - phase: 19-04
    provides: conflict resolution modal and Conflict type
  - phase: 18-02
    provides: IndexedDB sync infrastructure with api.syncRecords
provides:
  - fetchServerRecord helper for single record fetch via sync API
  - detectConflict accepts RecordSyncItem (fresh server data)
  - Accurate conflict detection comparing against current server state
affects: [20-field-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchServerRecord via syncRecords for single record lookup"
    - "RecordSyncItem for server-sourced data with updated_at"

key-files:
  created: []
  modified:
    - apps/web/src/lib/db/conflicts.ts
    - apps/web/src/lib/db/pending-mutations.ts

key-decisions:
  - "Use api.syncRecords for single record fetch (no GET /records/{id} endpoint)"
  - "If fetch fails, proceed with mutation (let it fail naturally)"
  - "RecordSyncItem enforces server data source requirement"

patterns-established:
  - "fetchServerRecord: fetch single record via bulk sync endpoint with client filter"
  - "RecordSyncItem for conflict detection (not BookkeepingRecord from IndexedDB)"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 19 Plan 06: Fix Conflict Detection Data Source Summary

**Conflict detection now fetches fresh server state via api.syncRecords before comparison, closing SYNC-06 gap**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T20:43:07Z
- **Completed:** 2026-01-24T20:46:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- detectConflict now accepts RecordSyncItem (which has updated_at from server)
- processQueue fetches current server record via fetchServerRecord helper
- Conflict detection compares mutation timestamp against fresh server updated_at
- False positives avoided (no longer comparing against stale IndexedDB data)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update detectConflict to accept RecordSyncItem** - `5984ef4` (feat)
2. **Task 2: Update processQueue to fetch server record via syncRecords** - `c46a1ca` (feat)

## Files Created/Modified

- `apps/web/src/lib/db/conflicts.ts` - Updated detectConflict signature to accept RecordSyncItem
- `apps/web/src/lib/db/pending-mutations.ts` - Added fetchServerRecord helper, updated processQueue

## Decisions Made

1. **Use api.syncRecords for single record fetch** - No GET /records/{id} endpoint exists, so we use syncRecords with limit=1000 and filter client-side. Future optimization could add dedicated endpoint.

2. **If fetch fails, proceed with mutation** - Rather than blocking, let the mutation attempt proceed. It will either succeed or fail with proper API error.

3. **RecordSyncItem type enforces server source** - By requiring RecordSyncItem (not BookkeepingRecord from db schema), the type system ensures detectConflict receives server data with accurate updated_at.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYNC-06 gap closed: conflict detection uses correct data source
- Ready for 19-07 (field-level resolution timestamp tracking)
- All conflict resolution infrastructure complete for Phase 20

---
*Phase: 19-sync-protocol*
*Completed: 2026-01-24*
