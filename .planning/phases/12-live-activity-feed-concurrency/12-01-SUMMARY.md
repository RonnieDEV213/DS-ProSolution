---
phase: 12-live-activity-feed-concurrency
plan: 01
subsystem: api
tags: [asyncio, sse, parallel, queue, streaming]

# Dependency graph
requires:
  - phase: 08-seller-discovery-pipeline
    provides: CollectionService with run execution
provides:
  - ParallelCollectionRunner class for concurrent task execution
  - ActivityStreamManager for real-time event streaming
  - SSE endpoint for live activity feed
  - Database schema for seller count snapshots
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Work-stealing queue pattern using asyncio.Queue
    - Singleton ActivityStreamManager with per-run queues
    - SSE streaming with keepalive pings

key-files:
  created:
    - apps/api/migrations/045_seller_snapshots.sql
    - apps/api/src/app/services/parallel_runner.py
    - apps/api/src/app/services/activity_stream.py
  modified:
    - apps/api/src/app/models.py
    - apps/api/src/app/routers/collection.py

key-decisions:
  - "5 workers (MAX_WORKERS) for optimal Oxylabs Micro plan concurrency"
  - "100-event buffer per run with oldest-drop overflow policy"
  - "15-second keepalive timeout for SSE connection health"
  - "Poison pill pattern for clean worker shutdown"
  - "Singleton pattern for ActivityStreamManager"

patterns-established:
  - "ParallelCollectionRunner: work-stealing queue with shared failure counter"
  - "ActivityStreamManager: singleton with per-run asyncio.Queue instances"
  - "SSE endpoint pattern with keepalive comments"

# Metrics
duration: 4min
completed: 2026-01-22
---

# Phase 12 Plan 01: Backend Infrastructure Summary

**ParallelCollectionRunner with work-stealing queue and ActivityStreamManager for SSE-based live activity streaming**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-22T00:00:00Z
- **Completed:** 2026-01-22T00:04:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created migration for seller_count_snapshot columns on collection_runs and seller_audit_log
- Implemented ParallelCollectionRunner with asyncio.Queue work-stealing and shared failure counter
- Created ActivityStreamManager singleton for per-run event queues
- Added SSE endpoint at /runs/{run_id}/activity for real-time streaming

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seller snapshot migration** - `e2674d1` (feat)
2. **Task 2: Create ParallelCollectionRunner class** - `fde42e4` (feat)
3. **Task 3: Create ActivityStreamManager and SSE endpoint** - `adff32c` (feat)

## Files Created/Modified

- `apps/api/migrations/045_seller_snapshots.sql` - Adds seller_count_snapshot columns to collection_runs and seller_audit_log
- `apps/api/src/app/services/parallel_runner.py` - ParallelCollectionRunner with 5 workers, asyncio.Queue, failure handling
- `apps/api/src/app/services/activity_stream.py` - ActivityStreamManager singleton, per-run queues, 100-event buffer
- `apps/api/src/app/models.py` - Added ActivityEntry model for SSE event schema
- `apps/api/src/app/routers/collection.py` - Added SSE endpoint /runs/{run_id}/activity

## Decisions Made

1. **5 workers (MAX_WORKERS=5)** - Conservative concurrency for Oxylabs Micro plan rate limits
2. **100-event buffer** - Balances memory usage with history depth
3. **15-second keepalive** - Prevents connection drops without excessive traffic
4. **Poison pill shutdown** - Clean worker termination pattern
5. **Singleton ActivityStreamManager** - Single source of truth for all run streams

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Run migration in Supabase SQL editor:
```sql
-- Run 045_seller_snapshots.sql in Supabase SQL editor
```

## Next Phase Readiness

- Backend infrastructure complete for parallel collection and activity streaming
- Plan 02 will integrate ParallelCollectionRunner into CollectionService
- Plan 03 will add frontend activity feed component using SSE endpoint

---
*Phase: 12-live-activity-feed-concurrency*
*Completed: 2026-01-22*
