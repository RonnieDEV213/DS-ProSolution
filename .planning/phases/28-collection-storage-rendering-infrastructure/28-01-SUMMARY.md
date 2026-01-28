---
phase: 28-collection-storage-rendering-infrastructure
plan: 01
subsystem: api
tags: [tanstack-query, query-keys, seller-api, offline-queue, indexeddb, pending-mutations]

# Dependency graph
requires:
  - phase: 15-server-storage-foundation
    provides: "Dexie schema with sellers table, pending mutations queue"
  - phase: 19-sync-protocol
    provides: "processQueue, executeMutation, queueMutation infrastructure"
provides:
  - "Seller query key factory (all/list/infinite) for TanStack Query cache management"
  - "sellerApi object with 6 typed CRUD functions matching backend endpoints"
  - "Exported getAccessToken for downstream authenticated requests"
  - "Seller mutation dispatch in offline queue (create/update/delete/flag)"
affects:
  - 28-02 (useSyncSellers hook will use query keys)
  - 28-03 (seller mutation hooks will use sellerApi and queueMutation)
  - 28-06 (collection polling will use getAccessToken export)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sellerApi as separate export from api object (entity-scoped API namespaces)"
    - "Table-first dispatch in executeMutation (switch on table, then operation)"
    - "Last-write-wins for sellers (no conflict detection, records-only guard)"

key-files:
  created: []
  modified:
    - "apps/web/src/lib/query-keys.ts"
    - "apps/web/src/lib/api.ts"
    - "apps/web/src/lib/db/pending-mutations.ts"

key-decisions:
  - "sellerApi is a separate exported object, not merged into existing api object"
  - "getAccessToken exported as named function (was file-scoped)"
  - "Conflict detection guarded by mutation.table === 'records' (sellers use last-write-wins)"
  - "Seller update dispatch checks 'flagged' in data before 'name' for flag toggle routing"
  - "accounts case added as no-op stub in executeMutation for type exhaustiveness"

patterns-established:
  - "Entity-scoped API namespace pattern: sellerApi separate from api"
  - "Table-first mutation dispatch: switch(table) -> switch(operation)"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 28 Plan 01: Seller API Layer and Query Key Infrastructure Summary

**Seller query key factory, 6 typed sellerApi CRUD functions, exported getAccessToken, and seller mutation dispatch in offline queue**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T17:18:19Z
- **Completed:** 2026-01-27T17:20:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added SellerFilters interface and sellers namespace (all/list/infinite) to query key factory
- Created sellerApi object with 6 typed functions matching all backend seller endpoints
- Exported getAccessToken for downstream modules (Plan 06 sync, collection polling)
- Extended executeMutation to dispatch seller create/update/delete/flag through sellerApi
- Added table guard to conflict detection (records-only, sellers use last-write-wins)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend query-keys.ts, add seller API functions and export getAccessToken** - `ad24a4e` (feat)
2. **Task 2: Extend executeMutation for seller operations** - `3f4f473` (feat)

## Files Created/Modified
- `apps/web/src/lib/query-keys.ts` - Added SellerFilters interface and sellers query key namespace
- `apps/web/src/lib/api.ts` - Added sellerApi object with 6 typed functions, exported getAccessToken
- `apps/web/src/lib/db/pending-mutations.ts` - Refactored executeMutation for table-first dispatch with seller support

## Decisions Made
- sellerApi is a separate exported object rather than merged into existing `api` object, maintaining backward compatibility
- getAccessToken exported as named function (was file-scoped) for downstream Plan 06 imports
- Conflict detection guarded by `mutation.table === 'records'` so sellers use last-write-wins strategy
- Seller update dispatch checks `'flagged' in mutation.data` before `'name'` to route flag toggles correctly
- Added `case 'accounts'` as no-op stub for type exhaustiveness in the table switch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Query key factory ready for useSyncSellers hook (Plan 02)
- sellerApi ready for seller mutation hooks (Plan 03)
- getAccessToken export ready for collection polling and sync (Plan 06)
- Offline queue can dispatch seller mutations when connectivity returns
- All existing bookkeeping functionality preserved (zero regressions)

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
