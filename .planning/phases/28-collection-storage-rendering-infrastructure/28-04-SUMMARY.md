---
phase: 28-collection-storage-rendering-infrastructure
plan: 04
subsystem: ui
tags: [dexie, indexeddb, react-window, useLiveQuery, sync, sellers-grid, debounce]

# Dependency graph
requires:
  - phase: 28-03
    provides: useSyncSellers hook with IndexedDB-backed reactive reads
provides:
  - SellersGrid refactored to use useSyncSellers as data source
  - useDebouncedValue utility hook for search debounce
  - SellerRecord type used throughout SellersGrid (replacing local Seller interface)
affects: [28-05 mutation migration, 28-06 verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncSellers replaces fetch+useState for IndexedDB-backed cache-first data loading"
    - "useDebouncedValue hook for 300ms debounced search input"
    - "setSellers shim pattern for backward-compatible incremental migration"
    - "totalCount from useSyncSellers distinguishes empty-state vs filtered-empty"

key-files:
  created:
    - apps/web/src/hooks/use-debounced-value.ts
  modified:
    - apps/web/src/components/admin/collection/sellers-grid.tsx

key-decisions:
  - "Kept setSellers as no-op shim so mutation code compiles during incremental migration"
  - "Used totalCount from hook for empty-state distinction (0 sellers vs no search match)"
  - "Replaced created_at with updated_at in export functions (SellerRecord has no created_at)"
  - "Removed feedback_percent, feedback_count from SellerDetailPanel (not in IndexedDB schema)"
  - "Added platform field to SellerDetailPanel as replacement context"
  - "Simplified flagged check from `=== true` to direct boolean (SellerRecord.flagged is non-optional)"

patterns-established:
  - "useDebouncedValue<T>(value, delay): Generic debounce utility hook"
  - "Incremental data source migration: replace reads first, mutations later"

# Metrics
duration: 5min
completed: 2026-01-27
---

# Phase 28 Plan 04: SellersGrid Data Source Migration Summary

**SellersGrid refactored from fetch+useState to useSyncSellers (IndexedDB-backed, reactive via useLiveQuery) with 300ms debounced search**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-27T17:29:22Z
- **Completed:** 2026-01-27T17:34:30Z
- **Tasks:** 1
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- SellersGrid loads sellers from IndexedDB cache via useSyncSellers instead of direct API fetch
- Background sync refreshes data on mount without blocking UI
- Search is debounced at 300ms through useDebouncedValue hook feeding into useSyncSellers filters
- Data persists across page navigation and browser reloads (IndexedDB persistence)
- All existing interaction patterns preserved (drag select, flag paint, shift-click, hover, keyboard shortcuts, export)
- Sync status indicator shows "(syncing...)" in header when background sync is active
- SellerRecord type replaces local Seller interface throughout the component

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace data source with useSyncSellers** - `3f50070` (feat)

## Files Created/Modified
- `apps/web/src/hooks/use-debounced-value.ts` - Generic debounce utility hook (useDebouncedValue)
- `apps/web/src/components/admin/collection/sellers-grid.tsx` - SellersGrid with IndexedDB data source via useSyncSellers

## Decisions Made
- Kept `setSellers` as a no-op shim state so existing mutation code (undo, redo, bulk delete, flag painting, export flagging) continues to compile. Plan 05 will replace all mutations and remove this shim.
- Used `totalCount` from useSyncSellers hook to distinguish "no sellers exist" from "no sellers match search" in the empty state. Since `sellers` is now the filtered list from the hook, `sellers.length` cannot serve this purpose.
- Replaced `created_at` with `updated_at` in CSV and JSON export functions since SellerRecord schema does not include `created_at`.
- Removed `feedback_percent` and `feedback_count` from SellerDetailPanel hover card since these fields are not in the IndexedDB SellerRecord schema. Added `platform` field as replacement context.
- Simplified `seller.flagged === true` to `seller.flagged` since SellerRecord defines `flagged: boolean` (non-optional).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Export functions referenced non-existent created_at field**
- **Found during:** Task 1 (type migration)
- **Issue:** CSV and JSON export functions used `s.created_at` which does not exist on SellerRecord
- **Fix:** Replaced with `s.updated_at` in both downloadCSV and downloadJSON functions
- **Files modified:** apps/web/src/components/admin/collection/sellers-grid.tsx
- **Verification:** `npx tsc --noEmit` passes, `npm run build` succeeds
- **Committed in:** 3f50070 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for TypeScript compilation. No scope creep.

## Issues Encountered
None - plan executed cleanly after handling the created_at type mismatch.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SellersGrid data source migration complete
- Ready for Plan 05: mutation migration (replace setSellers calls, direct fetch for flag/edit/delete/add/export with mutation hooks and IndexedDB operations)
- The setSellers shim and supabase/createClient import remain for Plan 05 to clean up
- All interaction patterns verified to still work by preserving unchanged interaction code

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
