---
phase: 31-collection-history-system
plan: 03
subsystem: web
tags: [react-query, mutations, flag-batch, audit-logging, sellers-grid]

# Dependency graph
requires:
  - phase: 31-01
    provides: POST /sellers/flag-batch endpoint, batch_toggle_flag() service method
provides:
  - sellerApi.flagBatch() and sellerApi.logExportEvent() frontend API helpers
  - useBatchFlagSellers hook for bulk flag operations
  - Individual flag toggles routed through batch endpoint for audit logging
  - Drag painting uses single batch mutation instead of N individual mutations
affects: [31-02, 31-04, 31-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Individual flag toggles route through batch endpoint (single-item array) for audit trail"
    - "Drag painting uses useBatchFlagSellers for single API call + single audit entry"
    - "flagExportedSellers uses batch mutation instead of per-seller loop"

key-files:
  created: []
  modified:
    - apps/web/src/lib/api.ts
    - apps/web/src/hooks/mutations/use-flag-seller.ts
    - apps/web/src/components/admin/collection/sellers-grid.tsx

key-decisions:
  - "Individual flag toggle uses flagBatch([id], flagged) to ensure every flag creates audit entry"
  - "Drag painting creates 1 audit entry per drag operation, not N entries"
  - "flagExportedSellers converted from per-seller loop to single batch call"

patterns-established:
  - "Batch mutation pattern: useBatchFlagSellers for bulk operations with optimistic IndexedDB + rollback"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 31 Plan 03: Flag Audit Logging Summary

**Routed all flag operations through batch endpoint for audit logging, added batch flag mutation for drag painting**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T03:03:15Z
- **Completed:** 2026-01-28T03:05:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `sellerApi.flagBatch()` and `sellerApi.logExportEvent()` API helpers to frontend
- Updated `useFlagSeller` hook to route individual flag toggles through the batch endpoint, ensuring every flag operation creates an audit log entry server-side
- Created `useBatchFlagSellers` hook for bulk flag operations with optimistic IndexedDB updates and rollback on error
- Replaced per-seller for-loop in drag painting handler with single `batchFlagMutation.mutate()` call (1 audit entry instead of N)
- Updated `flagExportedSellers` to use batch mutation instead of individual mutations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add API helpers and update flag mutation hook** - `eac783b` (feat)
2. **Task 2: Wire batch flag recording in sellers-grid drag painting** - `d1526b9` (feat)

## Files Created/Modified
- `apps/web/src/lib/api.ts` - Added flagBatch() and logExportEvent() to sellerApi object
- `apps/web/src/hooks/mutations/use-flag-seller.ts` - Updated useFlagSeller to use flagBatch; added useBatchFlagSellers export
- `apps/web/src/components/admin/collection/sellers-grid.tsx` - Imported useBatchFlagSellers, wired batch mutation for drag painting and flagExportedSellers

## Decisions Made
- Individual flag toggles route through flagBatch([id], flagged) rather than the old flagSeller(id) endpoint, ensuring server-side audit logging for every flag operation
- Drag painting N sellers creates exactly 1 audit log entry via batch endpoint
- flagExportedSellers converted to batch mutation (was per-seller loop)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - migration from Plan 01 must be applied for the batch endpoint to work.

## Next Phase Readiness
- All flag operations now create audit log entries on the server
- logExportEvent API helper ready for export modal (Plan 02) to call after exports
- useBatchFlagSellers available for any future bulk flag UI interactions

---
*Phase: 31-collection-history-system*
*Completed: 2026-01-28*
