---
phase: 28-collection-storage-rendering-infrastructure
plan: "05"
subsystem: ui
tags: [react, dexie, indexeddb, mutation-hooks, tanstack-query, optimistic-updates, streaming-export]

# Dependency graph
requires:
  - phase: 28-01
    provides: query-keys sellers namespace, sellerApi, pending-mutations sellers dispatch
  - phase: 28-02
    provides: server-side streaming export endpoints (/export/sellers/csv, /export/sellers/json)
  - phase: 28-03
    provides: useFlagSeller, useUpdateSeller, useDeleteSeller mutation hooks
  - phase: 28-04
    provides: useSyncSellers as SellersGrid data source, setSellers no-op shim
provides:
  - SellersGrid fully uses mutation hooks for all CRUD operations
  - Zero direct fetch() mutation calls in SellersGrid
  - Server-side streaming export routing for large datasets (>10k sellers)
  - Single-level undo for delete operations via db.sellers.bulkPut
affects: [28-06, 28-07, collection-ui-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation hooks pattern: all CRUD through useFlagSeller/useUpdateSeller/useDeleteSeller"
    - "Server-side streaming export routing: client-side for <10k, server-side for >10k"
    - "Single-level undo: capture to IndexedDB, restore via db.sellers.bulkPut + sellerApi"

key-files:
  created: []
  modified:
    - apps/web/src/components/admin/collection/sellers-grid.tsx

key-decisions:
  - "Removed redo support in favor of single-level undo (simpler, matches CONTEXT.md)"
  - "Server-side streaming threshold set at 10,000 sellers"
  - "Export routing uses authenticated fetch + blob download for server-side streaming"
  - "Add seller uses sellerApi (not mutation hook) since it creates new records server-side"

patterns-established:
  - "All CRUD mutations in SellersGrid flow through mutation hooks (IndexedDB first, then API)"
  - "useLiveQuery is the single source of truth for seller data (no useState for seller list)"
  - "Large dataset export routes to server-side streaming endpoints automatically"

# Metrics
duration: 18min
completed: 2026-01-27
---

# Phase 28 Plan 05: SellersGrid Mutation Migration Summary

**All SellersGrid CRUD operations migrated from direct fetch() to mutation hooks with IndexedDB-first optimistic updates and server-side streaming export routing for large datasets**

## Performance

- **Duration:** 18 min
- **Started:** 2026-01-27T17:27:26Z
- **Completed:** 2026-01-27T17:45:10Z
- **Tasks:** 5
- **Files modified:** 1

## Accomplishments
- Migrated all flag operations (single toggle, batch painting, export flagging) to useFlagSeller
- Migrated add seller to sellerApi.createSeller/createSellersBulk
- Migrated edit seller to useUpdateSeller mutation hook
- Migrated bulk delete to useDeleteSeller mutation hook with single-level undo
- Added server-side streaming export routing for datasets >10k sellers
- Removed all legacy patterns: createClient, supabase.auth, setSellers shim, handleRedo, redoStack

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate flag operations** - `23b989d` (feat)
2. **Task 2: Migrate add/edit/delete/export** - `0714d56` (feat)
3. **Task 3: Document SSE-to-IndexedDB data flow** - `1e6d7d4` (docs)
4. **Task 4: Remove legacy wiring, clean imports** - `1124088` (refactor)
5. **Task 5: Compile check and lint fixes** - `3fc3535` (fix)

## Files Created/Modified
- `apps/web/src/components/admin/collection/sellers-grid.tsx` - All CRUD operations now use mutation hooks; server-side streaming export routing; single-level undo via db.sellers.bulkPut

## Decisions Made
- **Single-level undo only (no redo):** Simplifies implementation per CONTEXT.md guidance. The undo stack holds one entry; new delete overwrites.
- **Server-side streaming threshold = 10,000:** Below this, client-side export from IndexedDB is fast enough. Above this, route to /export/sellers/{csv|json} endpoints.
- **Add seller uses sellerApi directly:** Unlike flag/edit/delete, adding a seller creates a new record server-side (needs server-generated ID). After API call, refetch() syncs the new record into IndexedDB.
- **No SSE handler migration needed:** The SSE handlers in activity-feed.tsx and progress-detail-modal.tsx only handle activity stream display, not seller data. The parent page's refreshTrigger mechanism correctly triggers re-sync through useSyncSellers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint warnings for exhaustive-deps and unused variable**
- **Found during:** Task 5 (compile check)
- **Issue:** saveEdit was not wrapped in useCallback, causing useMemo dependency instability; unused catch parameter `e`
- **Fix:** Wrapped saveEdit in useCallback with proper deps; removed unused catch parameter
- **Files modified:** apps/web/src/components/admin/collection/sellers-grid.tsx
- **Verification:** ESLint passes with zero warnings
- **Committed in:** 3fc3535 (Task 5 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, no scope creep.

## Issues Encountered
- Task 3 (SSE replacement) was effectively a no-op because Plan 04 already replaced the SSE-driven state with useSyncSellers, and Plan 05 Task 2 removed the setSellers shim. Documented the data flow architecture instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SellersGrid is now fully IndexedDB-first with mutation hooks
- All seller operations work offline (queued via pending-mutations)
- Server-side streaming export available for large datasets
- Ready for Plan 06 (collection run history persistence) and Plan 07 (data flow completion)

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
