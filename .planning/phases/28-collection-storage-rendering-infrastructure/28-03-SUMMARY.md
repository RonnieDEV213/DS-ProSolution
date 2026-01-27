---
phase: 28-collection-storage-rendering-infrastructure
plan: 03
subsystem: ui
tags: [dexie, indexeddb, react-hooks, tanstack-query, offline-queue, useLiveQuery]

# Dependency graph
requires:
  - phase: 28-01
    provides: sellerApi object, query-keys sellers namespace, executeMutation sellers case
provides:
  - useSyncSellers cache-first hook with reactive IndexedDB reads
  - useFlagSeller optimistic mutation with offline queue
  - useUpdateSeller optimistic mutation with snapshot rollback
  - useDeleteSeller bulk-capable optimistic mutation with offline queue
affects: [28-04-sellers-grid-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seller hooks use IndexedDB-only optimistic updates (no TanStack Query cache manipulation)"
    - "useLiveQuery provides automatic reactivity to IndexedDB changes from mutations"
    - "Dexie boolean index queried with equals(1) for true, equals(0) for false"
    - "Mutation hooks follow online/offline branching with queueMutation fallback"

key-files:
  created:
    - apps/web/src/hooks/sync/use-sync-sellers.ts
    - apps/web/src/hooks/mutations/use-flag-seller.ts
    - apps/web/src/hooks/mutations/use-update-seller.ts
    - apps/web/src/hooks/mutations/use-delete-seller.ts
  modified: []

key-decisions:
  - "No TanStack Query cache manipulation in seller mutations -- useLiveQuery is reactive to IndexedDB changes"
  - "No pagination at useSyncSellers hook level -- react-window handles rendering performance"
  - "Dexie boolean index equals(1) for true with fallback to in-memory filter"
  - "useDeleteSeller accepts array of IDs for bulk delete support"

patterns-established:
  - "Seller mutation hooks update IndexedDB directly; useLiveQuery propagates changes to UI"
  - "Seller flag toggle uses simple boolean inversion for rollback (no snapshot needed)"
  - "Seller update/delete use snapshot-based rollback via db.sellers.get/put"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 28 Plan 03: Seller Sync & Mutation Hooks Summary

**Cache-first useSyncSellers hook with reactive IndexedDB reads plus three optimistic mutation hooks (flag, update, delete) with offline queue support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T17:23:09Z
- **Completed:** 2026-01-27T17:25:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- useSyncSellers provides reactive seller reads from IndexedDB with background sync on mount
- Three mutation hooks (flag, update, delete) provide optimistic IndexedDB updates with offline queue
- All hooks follow established v3 patterns (useSyncRecords, useUpdateRecord, etc.)
- Ready for SellersGrid consumption in Plan 04

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useSyncSellers hook** - `3d6c4e1` (feat)
2. **Task 2: Create seller mutation hooks (flag, update, delete)** - `15ba4ab` (feat)

## Files Created/Modified
- `apps/web/src/hooks/sync/use-sync-sellers.ts` - Cache-first seller data hook with reactive IndexedDB reads, background sync, filter support, live counts
- `apps/web/src/hooks/mutations/use-flag-seller.ts` - Optimistic flag toggle with IndexedDB update, API call or offline queue, boolean rollback
- `apps/web/src/hooks/mutations/use-update-seller.ts` - Optimistic display_name update with snapshot rollback, API call or offline queue
- `apps/web/src/hooks/mutations/use-delete-seller.ts` - Bulk-capable optimistic delete with snapshot rollback, single/bulk API calls or offline queue

## Decisions Made
- No TanStack Query cache manipulation in seller mutations -- sellers use useLiveQuery which is automatically reactive to IndexedDB changes, eliminating the need for queryClient.setQueryData/invalidateQueries
- No pagination at useSyncSellers hook level -- SellersGrid uses react-window virtualization so the hook returns all matching sellers
- Dexie boolean index queried with equals(1) for true, with fallback to in-memory filter for flaggedCount
- useDeleteSeller accepts array of IDs and routes to single or bulk API endpoint accordingly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 hooks ready for SellersGrid consumption in Plan 04
- useSyncSellers replaces direct fetch()+useState pattern
- Mutation hooks replace inline fetch() calls for flag/update/delete
- Offline queue integration complete via queueMutation

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
