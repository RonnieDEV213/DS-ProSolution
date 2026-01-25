---
phase: 21-export-import
plan: 03
subsystem: api
tags: [fastapi, import, csv, excel, pandas, validation, rollback, batch-tracking]

# Dependency graph
requires:
  - phase: 15-data-schema
    provides: bookkeeping_records table structure
  - phase: 16-sync-infrastructure
    provides: cursor pagination patterns
provides:
  - Import validation endpoint with 100-row preview
  - Smart column mapping using difflib similarity
  - All-or-nothing import commit with batch tracking
  - 24-hour rollback window with modified record detection
  - import_batches table for tracking imports
affects: [21-04-frontend-import-ui, future-data-migration]

# Tech tracking
tech-stack:
  added: [pandas, difflib]
  patterns: [import-batch-tracking, soft-delete-rollback, column-similarity-mapping]

key-files:
  created:
    - apps/api/migrations/049_import_batch_tracking.sql
    - apps/api/src/app/services/import_service.py
    - apps/api/src/app/routers/import_router.py
  modified:
    - apps/api/src/app/models.py
    - apps/api/src/app/main.py
    - apps/api/src/app/routers/__init__.py

key-decisions:
  - "70% similarity threshold for fuzzy column mapping"
  - "All-or-nothing import: if any row invalid, entire import fails"
  - "Soft-delete for rollback with batch_id tracking"
  - "24-hour rollback window enforced by both code and database function"
  - "Modified record detection compares updated_at vs created_at"

patterns-established:
  - "Import batch tracking: Each import gets unique batch_id stored on records"
  - "Column mapping suggestion: difflib.SequenceMatcher for fuzzy header matching"
  - "Rollback warning flow: Check eligibility, return warning if modified records, require force flag"

# Metrics
duration: 4min
completed: 2026-01-25
---

# Phase 21 Plan 03: Backend Import Infrastructure Summary

**Backend import infrastructure with pandas parsing, smart column mapping via difflib, batch tracking in import_batches table, and 24-hour rollback with modified record detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-25T05:03:24Z
- **Completed:** 2026-01-25T05:07:48Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Database migration for import_batches table with RLS policies
- Import service with CSV/JSON/Excel parsing via pandas
- Smart column mapping using difflib.SequenceMatcher (70% threshold)
- All-or-nothing import commit with batch tracking
- Rollback with 24-hour window and modified record detection
- Full import router with validation, commit, and rollback endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration for import batch tracking** - `bca6f81` (feat)
2. **Task 2: Add import models and create import service** - `8037c81` (feat)
3. **Task 3: Create import router with endpoints** - `1dca7dd` (feat)

## Files Created/Modified

- `apps/api/migrations/049_import_batch_tracking.sql` - Import batch table with RLS, indexes, and disable_old_import_rollbacks() function
- `apps/api/src/app/services/import_service.py` - Import validation, column mapping, batch commit, rollback logic
- `apps/api/src/app/routers/import_router.py` - REST endpoints for validate, commit, list batches, rollback
- `apps/api/src/app/models.py` - ImportFormat enum, validation/commit/rollback response models
- `apps/api/src/app/main.py` - Router registration
- `apps/api/src/app/routers/__init__.py` - Router export

## Decisions Made

1. **70% similarity threshold for fuzzy column mapping** - Balances flexibility with accuracy; avoids false positive mappings while catching common variations like "Order ID" -> "ebay_order_id"

2. **All-or-nothing import transaction** - Prevents partial imports that leave data in inconsistent state; user sees all errors upfront

3. **Soft-delete for rollback** - Follows existing codebase pattern (deleted_at column), maintains audit trail

4. **Modified record detection via timestamp comparison** - If updated_at > created_at by more than 1 second, record was modified; warns user before rollback

5. **24-hour rollback window** - Per CONTEXT.md requirement; enforced in code and by disable_old_import_rollbacks() database function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Linter reverted router registration changes** - Had to re-apply edits to `__init__.py` and `main.py` after linter modified them. Resolved by re-editing files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Import API complete and ready for frontend integration
- Endpoints available: POST /import/records/validate, POST /import/records/commit, GET /import/batches, GET /import/batches/{id}, POST /import/batches/{id}/rollback, POST /import/batches/{id}/disable-rollback
- Migration needs to be applied to database before use

---
*Phase: 21-export-import*
*Completed: 2026-01-25*
