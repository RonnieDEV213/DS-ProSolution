---
phase: 18-client-persistence
plan: 02
subsystem: database
tags: [dexie, indexeddb, react, sync, cache, useLiveQuery, incremental-sync]

# Dependency graph
requires:
  - phase: 18-01
    provides: IndexedDB database singleton with Dexie.js, sync API client methods
  - phase: 16-sync-api
    provides: Cursor-based sync endpoints for records, accounts, sellers
provides:
  - Sync engine with per-table checkpoints (syncRecords, syncAccounts, syncSellers)
  - Cache-first hook useSyncRecords with useLiveQuery
  - Prefetch hook usePrefetchOnScroll for scroll-triggered loading
  - Client-side computed fields (profit, earnings, COGS)
affects: [19-offline-ux, future-infinite-scroll-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [cache-first with background sync, incremental sync with cursors, client-side computed fields]

key-files:
  created:
    - apps/web/src/lib/db/sync.ts
    - apps/web/src/hooks/sync/use-sync-records.ts
    - apps/web/src/hooks/sync/use-prefetch-on-scroll.ts
  modified:
    - apps/web/src/hooks/queries/use-records-infinite.ts
    - apps/web/src/hooks/queries/use-accounts.ts

key-decisions:
  - "Incremental sync using updated_since parameter from _sync_meta"
  - "Save cursor during sync for resume on interruption"
  - "Client computes profit/earnings/COGS from raw sync data"
  - "useLiveQuery for reactive updates when IndexedDB changes"
  - "IntersectionObserver for efficient scroll prefetch detection"

patterns-established:
  - "Sync function pattern: loop while hasMore, bulk upsert active, bulk delete deleted"
  - "Cache-first hook pattern: useLiveQuery + useEffect for background sync"
  - "Prefetch sentinel pattern: invisible element with ref at end of list"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 18 Plan 02: Sync Engine Summary

**Incremental sync engine with per-table checkpoints, cache-first useSyncRecords hook using useLiveQuery, and prefetch hook for scroll-triggered loading**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T07:26:31Z
- **Completed:** 2026-01-24T07:29:31Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Sync engine that fetches only changed records since last sync
- Soft delete handling removes deleted records from local cache
- Cache-first hook returns IndexedDB data immediately, syncs in background
- useLiveQuery provides reactive UI updates when IndexedDB changes
- Prefetch hook uses IntersectionObserver for efficient scroll detection
- useRecordsInfinite now uses sync endpoint with proper cursor pagination

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sync engine with per-table checkpoints** - `b5d64d2` (feat)
2. **Task 2: Create cache-first hooks with useLiveQuery** - `c95348f` (feat)
3. **Task 3: Update existing hooks to use sync endpoint** - `3f119cb` (feat)

## Files Created/Modified
- `apps/web/src/lib/db/sync.ts` - Sync engine with syncRecords, syncAccounts, syncSellers
- `apps/web/src/hooks/sync/use-sync-records.ts` - Cache-first hook with useLiveQuery
- `apps/web/src/hooks/sync/use-prefetch-on-scroll.ts` - IntersectionObserver prefetch
- `apps/web/src/hooks/queries/use-records-infinite.ts` - Updated to use sync endpoint
- `apps/web/src/hooks/queries/use-accounts.ts` - Added clarifying comment

## Decisions Made
- **Incremental sync:** Uses updated_since parameter from _sync_meta table for delta sync
- **Cursor persistence:** Saves cursor during sync for resume on interruption
- **Client-side computed fields:** Server sends raw data, client computes profit/earnings/COGS
- **Reactive queries:** useLiveQuery automatically re-runs when IndexedDB changes
- **Prefetch threshold:** Default 0.75 means trigger when 25% from bottom

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sync engine ready for offline UX features in Phase 19
- Cache-first hooks ready for use in any component
- Prefetch hook ready for infinite scroll implementation
- getLastSyncTime exported for "Last synced X ago" UI in Phase 19

---
*Phase: 18-client-persistence*
*Completed: 2026-01-24*
