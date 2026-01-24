---
phase: 17-client-query-caching
plan: 02
subsystem: ui
tags: [tanstack-query, mutations, cache-invalidation, react, optimistic-updates]

# Dependency graph
requires:
  - phase: 17-01
    provides: TanStack Query infrastructure (query-keys, query-client, query hooks)
provides:
  - Mutation hooks for create/update/delete with cache invalidation
  - Bookkeeping view migrated to TanStack Query
  - Optimistic delete with rollback
affects: [18-indexeddb-storage, 19-sync-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [mutation-hooks-with-invalidation, optimistic-updates-with-rollback]

key-files:
  created:
    - apps/web/src/hooks/mutations/use-create-record.ts
    - apps/web/src/hooks/mutations/use-update-record.ts
    - apps/web/src/hooks/mutations/use-delete-record.ts
  modified:
    - apps/web/src/components/bookkeeping/bookkeeping-content.tsx
    - apps/web/src/components/bookkeeping/records-table.tsx
    - apps/web/src/components/bookkeeping/add-record-dialog.tsx

key-decisions:
  - "Optimistic delete with rollback for instant UI feedback"
  - "Remarks use direct API calls (separate endpoints) while record fields use mutation hooks"
  - "DEFAULT_ORG_ID placeholder until multi-org support added"

patterns-established:
  - "Mutation hook pattern: useMutation with onSuccess invalidation"
  - "Optimistic update pattern: onMutate snapshot, onError rollback, onSettled invalidation"
  - "Component receives orgId/accountId props for mutation hooks"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 17 Plan 02: Mutation Hooks Summary

**Create/update/delete mutations with cache invalidation and optimistic deletes, bookkeeping view fully migrated to TanStack Query**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T08:00:00Z
- **Completed:** 2026-01-24T08:04:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created mutation hooks for all CRUD operations with automatic cache invalidation
- Migrated bookkeeping-content.tsx from useState/useEffect to TanStack Query hooks
- Implemented optimistic delete with rollback on error for instant UI feedback
- Added background refetch indicator (spinner) for stale-while-revalidate pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mutation hooks with cache invalidation** - `fb0a7d6` (feat)
2. **Task 2: Migrate bookkeeping-content to TanStack Query** - `f80d8bb` (feat)

## Files Created/Modified
- `apps/web/src/hooks/mutations/use-create-record.ts` - Create mutation with cache invalidation
- `apps/web/src/hooks/mutations/use-update-record.ts` - Update mutation with cache invalidation
- `apps/web/src/hooks/mutations/use-delete-record.ts` - Delete mutation with optimistic updates
- `apps/web/src/components/bookkeeping/bookkeeping-content.tsx` - Uses useAccounts and useRecordsInfinite
- `apps/web/src/components/bookkeeping/records-table.tsx` - Uses useUpdateRecord and useDeleteRecord
- `apps/web/src/components/bookkeeping/add-record-dialog.tsx` - Uses useCreateRecord

## Decisions Made
- **Optimistic delete with rollback:** Delete mutation uses onMutate to remove from cache immediately, onError to rollback if API fails, onSettled to ensure consistency
- **Remarks use direct API calls:** order_remark and service_remark have separate endpoints, so they bypass mutation hooks but still trigger proper UI updates
- **orgId/accountId as props:** Child components receive these as props for mutation hook initialization (will be replaced by context in multi-org phase)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Query caching infrastructure complete
- Mutations automatically invalidate cache
- Ready for Phase 18 (IndexedDB Storage) to add offline persistence
- Cache keys and invalidation patterns established for sync engine

---
*Phase: 17-client-query-caching*
*Completed: 2026-01-24*
