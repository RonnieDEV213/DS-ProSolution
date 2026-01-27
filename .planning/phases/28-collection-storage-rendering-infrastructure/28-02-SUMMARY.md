---
phase: 28-collection-storage-rendering-infrastructure
plan: 02
subsystem: api
tags: [fastapi, streaming, csv, json, export, sellers]

# Dependency graph
requires:
  - phase: 21-export-import
    provides: "Streaming export pattern (generate_csv_stream, generate_json_stream)"
provides:
  - "GET /export/sellers/csv streaming endpoint"
  - "GET /export/sellers/json streaming endpoint"
  - "generate_sellers_csv_stream async generator"
  - "generate_sellers_json_stream async generator"
affects: [28-05-sellers-grid-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seller export uses org_id scope (not account_id) since sellers are org-wide"
    - "Cursor pagination on (created_at DESC, id DESC) for consistent export order"
    - "_extract_seller_row helper excludes internal columns from export"

key-files:
  created: []
  modified:
    - "apps/api/src/app/services/export_service.py"
    - "apps/api/src/app/routers/export.py"

key-decisions:
  - "Seller export excludes internal columns (id, org_id, run IDs, updated_at, deleted_at) - only user-facing fields exported"
  - "Permission gated by seller_collection.read (not admin.automation) to match sync endpoint pattern"
  - "Cursor pagination using compound (created_at, id) DESC for deterministic ordering across batches"

patterns-established:
  - "Seller streaming export: generate_sellers_*_stream(supabase, org_id, flagged=None)"
  - "_extract_seller_row helper for user-facing field extraction from seller DB record"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 28 Plan 02: Seller Streaming Export Summary

**Streaming CSV and JSON export endpoints for sellers with cursor-paginated generators and org-level permission gating**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T17:18:21Z
- **Completed:** 2026-01-27T17:20:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added streaming CSV/JSON export generators with cursor pagination (batch size 100) for memory-efficient seller export
- Added two new GET endpoints under /export/sellers/ gated by seller_collection.read permission
- Both endpoints accept optional flagged boolean filter for export filtering
- All existing records export endpoints preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add seller stream generators to export_service.py** - `529b3c3` (feat)
2. **Task 2: Add seller export endpoints to export router** - `fc86f43` (feat)

## Files Created/Modified
- `apps/api/src/app/services/export_service.py` - Added generate_sellers_csv_stream, generate_sellers_json_stream, _extract_seller_row, and SELLER_CSV_HEADERS constant
- `apps/api/src/app/routers/export.py` - Added GET /export/sellers/csv and GET /export/sellers/json endpoints with seller_collection.read permission

## Decisions Made
- Seller export uses org_id scope (sellers are org-wide, unlike records which are per-account)
- Permission uses seller_collection.read to match the sync endpoint pattern from Phase 16
- Export headers include: display_name, normalized_name, platform, platform_id, times_seen, feedback_percent, feedback_count, flagged, created_at
- Internal columns excluded from export: id, org_id, first_seen_run_id, last_seen_run_id, updated_at, deleted_at
- Cursor pagination compound key (created_at DESC, id DESC) for deterministic ordering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Seller streaming export endpoints ready for Plan 05 to wire into SellersGrid large-dataset export path
- Both endpoints follow established patterns and are immediately available at /export/sellers/csv and /export/sellers/json
- No blockers for subsequent plans

---
*Phase: 28-collection-storage-rendering-infrastructure*
*Completed: 2026-01-27*
