---
phase: 19-sync-protocol
plan: 03
subsystem: ui
tags: [indexeddb, dexie, offline-first, sync-status, react-hooks]

# Dependency graph
requires:
  - phase: 18-client-persistence
    provides: IndexedDB schema with records/accounts/sellers tables
  - phase: 19-01
    provides: useOnlineStatus hook for network detection
  - phase: 19-02
    provides: Optimistic mutation patterns
provides:
  - PendingMutation interface for offline queue
  - _pending_mutations IndexedDB table
  - queueMutation/processQueue queue management
  - Conflict detection with detectConflict
  - SyncRowBadge component for row-level status
  - usePendingMutations hook for reactive status lookup
affects: [19-04, 20-server-storage]

# Tech tracking
tech-stack:
  added: []
  patterns: [offline-queue-pattern, row-level-sync-status]

key-files:
  created:
    - apps/web/src/lib/db/pending-mutations.ts
    - apps/web/src/lib/db/conflicts.ts
    - apps/web/src/hooks/sync/use-pending-mutations.ts
    - apps/web/src/components/sync/sync-row-badge.tsx
  modified:
    - apps/web/src/lib/db/schema.ts
    - apps/web/src/lib/db/index.ts
    - apps/web/src/components/bookkeeping/records-table.tsx

key-decisions:
  - "Schema version 2 triggers full resync per 18-01 decision"
  - "Conflict detection uses IndexedDB record (has updated_at) not API response"
  - "4xx errors skip retry (validation errors per 19-02 decision)"
  - "SyncRowBadge in expand column - compact placement"

patterns-established:
  - "Offline queue: queueMutation -> processQueue with sequential execution"
  - "Row-level status: usePendingMutations returns Map for O(1) lookup per record"

# Metrics
duration: 7min
completed: 2026-01-24
---

# Phase 19 Plan 03: Row-level Sync Badges Summary

**Offline mutation queue with per-row sync status badges showing pending/failed states via IndexedDB and reactive Dexie hooks**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-24T20:09:20Z
- **Completed:** 2026-01-24T20:16:05Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `_pending_mutations` IndexedDB table for queuing offline changes with status tracking
- Queue management with sequential processing, conflict detection, and retry logic
- Row-level sync badges showing spinner (pending) or error icon (failed) per record
- Reactive usePendingMutations hook using Dexie useLiveQuery for automatic UI updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend IndexedDB schema with pending mutations table** - `d0b8751` (feat)
2. **Task 2: Create pending mutations queue manager with conflict detection** - `3f364ef` (feat)
3. **Task 3: Create row-level sync status badge and wire to RecordsTable** - `1ba6d2c` (feat)

## Files Created/Modified

- `apps/web/src/lib/db/schema.ts` - Added PendingMutation interface
- `apps/web/src/lib/db/index.ts` - Added _pending_mutations table, schema v2
- `apps/web/src/lib/db/pending-mutations.ts` - Queue management (queueMutation, processQueue, retry, discard)
- `apps/web/src/lib/db/conflicts.ts` - Conflict detection and resolution logic
- `apps/web/src/hooks/sync/use-pending-mutations.ts` - Reactive hook for per-record status
- `apps/web/src/components/sync/sync-row-badge.tsx` - Row-level badge with retry button
- `apps/web/src/components/bookkeeping/records-table.tsx` - Wired SyncRowBadge to first column

## Decisions Made

1. **Schema version increment to 2** - Per 18-01 decision, schema changes trigger full resync which is acceptable
2. **Conflict detection uses IndexedDB record** - The API's BookkeepingRecord lacks updated_at; IndexedDB record has it for timestamp comparison
3. **4xx errors skip retry** - Validation errors (400, 401, 403, 404, 422) don't benefit from retry per 19-02 decision
4. **Badge placement in expand column** - Compact, doesn't add new column, visible alongside expand chevron

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created conflicts.ts stub for import**
- **Found during:** Task 2 (pending-mutations.ts creation)
- **Issue:** Plan references `detectConflict` from `./conflicts.ts` but file didn't exist
- **Fix:** Created conflicts.ts with full conflict detection and resolution logic (more complete than stub)
- **Files modified:** apps/web/src/lib/db/conflicts.ts
- **Verification:** TypeScript compiles, processQueue can call detectConflict
- **Committed in:** 3f364ef (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for compilation. The conflicts.ts implementation is more complete than a stub, which benefits Plan 19-04.

## Issues Encountered

- Type mismatch between API BookkeepingRecord (no updated_at) and IndexedDB BookkeepingRecord (has updated_at) - resolved by using IndexedDB record for conflict detection since it has the timestamp needed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 19-04 (Conflict Resolution Modal)
- conflicts.ts provides detectConflict and resolveConflict functions
- processQueue accepts onConflict callback for wiring to SyncProvider
- SyncRowBadge already supports failed state with retry button

---
*Phase: 19-sync-protocol*
*Completed: 2026-01-24*
