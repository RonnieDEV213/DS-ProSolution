---
phase: 28-collection-storage-rendering-infrastructure
plan: 06
subsystem: ui
tags: [dexie, indexeddb, tanstack-query, polling, collection, sync, cache-first]

# Dependency graph
requires:
  - phase: 28-01
    provides: "sellerApi, getAccessToken export, query-keys sellers namespace"
  - phase: 19-sync-protocol
    provides: "syncRecords/syncSellers pattern, Dexie schema, useSyncRecords template"
provides:
  - "collection_runs IndexedDB table with CollectionRunRecord type"
  - "syncCollectionRuns() incremental sync function"
  - "useSyncRunHistory hook (cache-first run history with background sync)"
  - "collection query keys (all/active/progress)"
  - "TanStack Query-based useCollectionPolling with refetchInterval"
affects: [collection-ui, collection-history, collection-progress]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-first run history: IndexedDB + background sync for collection runs"
    - "TanStack Query polling: refetchInterval replaces manual setInterval"
    - "Conditional query: progress query enabled only when activeRun exists"

key-files:
  created:
    - "apps/web/src/hooks/sync/use-sync-run-history.ts"
  modified:
    - "apps/web/src/lib/db/schema.ts"
    - "apps/web/src/lib/db/index.ts"
    - "apps/web/src/lib/db/sync.ts"
    - "apps/web/src/lib/query-keys.ts"
    - "apps/web/src/hooks/use-collection-polling.ts"
    - "apps/web/src/components/admin/collection/collection-history.tsx"
    - "apps/web/src/components/admin/collection/history-panel.tsx"

key-decisions:
  - "SCHEMA_VERSION bumped from 2 to 3 (triggers one-time data wipe + resync for collection_runs table)"
  - "syncCollectionRuns fetches from /collection/runs/history (not /sync/collection-runs) since no dedicated sync endpoint exists"
  - "history-panel.tsx keeps server fetch for audit logs (not persisted in IndexedDB) while using useSyncRunHistory for runs"
  - "collection-history.tsx replaces createClient+supabase.auth with getAccessToken for export action"
  - "useCollectionPolling returns identical shape (backward compatible with CollectionProgressProvider)"

patterns-established:
  - "Cache-first collection run history via IndexedDB + Dexie useLiveQuery"
  - "TanStack Query refetchInterval for polling (replaces manual setInterval pattern)"

# Metrics
duration: 4min
completed: 2026-01-27
---

# Phase 28 Plan 06: Collection Run History Persistence and Polling Migration Summary

**IndexedDB persistence for collection run history via useSyncRunHistory hook, TanStack Query migration for useCollectionPolling with refetchInterval**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T17:23:11Z
- **Completed:** 2026-01-27T17:27:18Z
- **Tasks:** 2
- **Files modified:** 8 (7 modified, 1 created)

## Accomplishments
- Collection run history loads instantly from IndexedDB on revisit (no loading spinner for cached data)
- Run history syncs incrementally from server on mount via syncCollectionRuns()
- useCollectionPolling fully migrated to TanStack Query with automatic retry, caching, and DevTools visibility
- Both collection-history.tsx and history-panel.tsx consume useSyncRunHistory instead of direct fetch
- Polling automatically pauses when page is not visible (TanStack Query built-in behavior)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add collection_runs table, useSyncRunHistory hook, and wire into UI** - `a525a3f` (feat)
2. **Task 2: Migrate useCollectionPolling to TanStack Query** - `0bbc9c3` (feat)

## Files Created/Modified
- `apps/web/src/lib/db/schema.ts` - Added CollectionRunRecord interface with full run metadata
- `apps/web/src/lib/db/index.ts` - Added collection_runs Dexie table, bumped SCHEMA_VERSION to 3
- `apps/web/src/lib/db/sync.ts` - Added syncCollectionRuns() function and updated clearAllData()
- `apps/web/src/lib/query-keys.ts` - Added collection.runs query key namespace (all/active/progress)
- `apps/web/src/hooks/sync/use-sync-run-history.ts` - New cache-first hook with IndexedDB + background sync
- `apps/web/src/hooks/use-collection-polling.ts` - Rewritten with TanStack Query useQuery + refetchInterval
- `apps/web/src/components/admin/collection/collection-history.tsx` - Replaced direct fetch with useSyncRunHistory
- `apps/web/src/components/admin/collection/history-panel.tsx` - Replaced direct fetch for runs with useSyncRunHistory, kept audit log server fetch

## Decisions Made
- **SCHEMA_VERSION 2 to 3:** Adding collection_runs table requires a version bump. This triggers a one-time wipe of all IndexedDB data. The sync infrastructure handles automatic resync gracefully.
- **Server endpoint choice:** Used `/collection/runs/history` for sync (not a dedicated `/sync/collection-runs`) since the dataset is small (<100 runs typically) and no dedicated sync endpoint exists.
- **Audit logs stay server-fetched:** In history-panel.tsx, manual edit audit logs are still fetched from the server per-request (not persisted in IndexedDB). Only collection runs are cached. This avoids adding another IndexedDB table for infrequently-accessed data.
- **getAccessToken for export:** collection-history.tsx's export action now uses getAccessToken from @/lib/api instead of createClient/supabase.auth, matching the v3 migration pattern.
- **Backward compatible return shape:** useCollectionPolling returns the same `{ activeRun, progress, newSellerIds, addNewSellerId, clearNewSellerIds, refresh }` shape, so CollectionProgressProvider and all consumers need zero changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 plans in Phase 28 are now complete
- Collection run history persists in IndexedDB for instant revisit loads
- useCollectionPolling is visible in TanStack Query DevTools
- Manual edit audit logs continue to work via _pending_mutations table (covered by Plan 01)
- Ready for phase-level verification

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
