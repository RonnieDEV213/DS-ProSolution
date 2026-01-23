---
phase: 13-worker-status-dashboard-metrics
plan: 01
subsystem: api
tags: [sse, activity-events, parallel-workers, collection, metrics]

# Dependency graph
requires:
  - phase: 12-live-activity-feed
    provides: ActivityEvent dataclass and SSE streaming infrastructure
provides:
  - Extended ActivityEvent with 10 new optional fields for rich metadata
  - Rich event emission with timing, api_params, and error classification
  - Pipeline events for data operations (uploading, deduped, inserted, updated)
affects: [13-02, 13-03, 13-04, worker-dashboard-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rich activity events with full API transparency (url, api_params, duration_ms)"
    - "Error classification (error_type, error_stage) for error analytics"
    - "Pipeline events with worker_id=0 for system-level operations"
    - "source_worker_id attribution for tracing data origin"

key-files:
  created: []
  modified:
    - apps/api/src/app/services/parallel_runner.py
    - apps/api/src/app/services/collection.py

key-decisions:
  - "ActivityEvent extended with optional fields (backward compatible via to_dict None filtering)"
  - "Pipeline events use worker_id=0 to distinguish from worker-specific events"
  - "Error types: rate_limit, timeout, http_500, api_error"
  - "Error stages: api, product_extraction, seller_extraction, price_parsing"
  - "Deduplication count includes both within-batch and existing-in-DB duplicates"

patterns-established:
  - "api_params dict: stores query parameters for debugging (node_id for Amazon, query/price_min/price_max/page for eBay)"
  - "duration_ms: milliseconds from time.time() delta for request timing"
  - "Pipeline operation_types: product_batch, seller_dedupe, seller_update, seller_insert"

# Metrics
duration: 3min
completed: 2026-01-23
---

# Phase 13 Plan 01: Rich Activity Events Summary

**Extended ActivityEvent with 10 new fields for full worker transparency and pipeline operation tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-23T18:57:28Z
- **Completed:** 2026-01-23T19:00:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended ActivityEvent dataclass with rich metadata fields (url, api_params, duration_ms, started_at, attempt, error_type, error_stage, items_count, source_worker_id, operation_type)
- Updated Amazon phase to emit api_params, duration_ms, attempt, and error classification
- Updated eBay phase with full api_params (query, price range, page) and timing
- Added pipeline events for batch operations (uploading products, deduping/updating/inserting sellers)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ActivityEvent Dataclass** - `9ff3877` (feat)
2. **Task 2: Emit Rich Events and Pipeline Events** - `a5b912e` (feat)

## Files Created/Modified
- `apps/api/src/app/services/parallel_runner.py` - Extended ActivityEvent dataclass with 10 new optional fields
- `apps/api/src/app/services/collection.py` - Updated event emission with rich metadata and pipeline events

## Decisions Made
- Used optional fields with None defaults for backward compatibility (to_dict already filters None)
- Pipeline events use worker_id=0 (system) with source_worker_id for attribution
- Error classification granularity: type (rate_limit/timeout/http_500/api_error) and stage (api/extraction)
- Deduplication tracking counts both within-batch duplicates and existing DB sellers

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rich activity events ready for frontend consumption
- Frontend can now display: URL being hit, API parameters, request duration, error classification
- Pipeline operations visible in activity stream for data flow transparency
- Ready for Phase 13-02: Frontend worker status cards with rich metadata display

---
*Phase: 13-worker-status-dashboard-metrics*
*Completed: 2026-01-23*
