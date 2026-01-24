---
phase: 19-sync-protocol
plan: 05
subsystem: sync
tags: [offline-first, mutation, indexeddb, react-query, hooks]

# Dependency graph
requires:
  - phase: 19-01
    provides: useOnlineStatus hook for detecting browser connectivity
  - phase: 19-02
    provides: queueMutation function for IndexedDB pending queue
  - phase: 19-03
    provides: SyncRowBadge displaying pending state via usePendingMutations
  - phase: 19-04
    provides: SyncProvider calling processQueue when coming online
provides:
  - Offline mutation queueing in useUpdateRecord
  - Offline mutation queueing in useCreateRecord
  - Offline mutation queueing in useDeleteRecord
  - Complete SYNC-07 gap closure (mutations queue offline, sync when online)
affects: [20-field-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offline-first mutations: check isOnline before API call"
    - "Queue offline mutations with temp ID for creates"

key-files:
  created: []
  modified:
    - apps/web/src/hooks/mutations/use-update-record.ts
    - apps/web/src/hooks/mutations/use-create-record.ts
    - apps/web/src/hooks/mutations/use-delete-record.ts

key-decisions:
  - "useOnlineStatus called at hook level, not inside mutationFn"
  - "Offline mutations return optimistic data shape for React Query cache"
  - "Create mutations generate temp ID in mutationFn for queue tracking"

patterns-established:
  - "Offline-first mutation: check isOnline, queue if offline, call API if online"
  - "Double cast (as unknown as Record<string, unknown>) for type-safe queueing"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 19 Plan 05: Offline Mutation Queueing Summary

**All mutation hooks (update/create/delete) now check online status and queue to IndexedDB when offline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T20:43:07Z
- **Completed:** 2026-01-24T20:45:55Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- useUpdateRecord checks isOnline and queues mutations when offline
- useCreateRecord generates temp ID and queues creates when offline
- useDeleteRecord queues deletes when offline
- SYNC-07 gap closed: mutations work seamlessly offline

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire offline queueing into useUpdateRecord** - `95fa1d6` (feat)
2. **Task 2: Wire offline queueing into useCreateRecord** - `0f6cc19` (feat)
3. **Task 3: Wire offline queueing into useDeleteRecord** - `4fc2451` (feat)

## Files Modified
- `apps/web/src/hooks/mutations/use-update-record.ts` - Added offline queueing with queueMutation()
- `apps/web/src/hooks/mutations/use-create-record.ts` - Added offline queueing with temp ID generation
- `apps/web/src/hooks/mutations/use-delete-record.ts` - Added offline queueing for deletes

## Decisions Made
- **useOnlineStatus at hook level:** Called once per hook instantiation, value captured in mutationFn closure. This works because React re-renders when online status changes, giving mutationFn the current value.
- **Optimistic data return when offline:** When offline, mutationFn returns optimistic data shape so React Query cache updates. onMutate already handles IndexedDB persistence.
- **Temp ID for creates:** Generate `temp-${uuid}` in mutationFn for queue tracking. Note: onMutate also generates a temp ID separately - both will be reconciled when sync completes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript type error in useCreateRecord**
- **Found during:** Task 2 (useCreateRecord modification)
- **Issue:** `RecordCreate` type couldn't be directly cast to `Record<string, unknown>`
- **Fix:** Changed to double cast `data as unknown as Record<string, unknown>`
- **Files modified:** apps/web/src/hooks/mutations/use-create-record.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0f6cc19 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type cast fix, no scope creep.

## Issues Encountered
None - plan executed as written.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SYNC-07 complete: mutations queue offline and sync when online
- Row-level badges (from 19-03) already show pending state
- processQueue (from 19-04) already processes when coming online
- Phase 19 sync protocol complete, ready for Phase 20

---
*Phase: 19-sync-protocol*
*Completed: 2026-01-24*
