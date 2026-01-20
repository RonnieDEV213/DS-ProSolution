---
phase: 06-collection-infrastructure
plan: 02
subsystem: api
tags: [fastapi, pydantic, collection, budget-enforcement, checkpointing]

# Dependency graph
requires:
  - phase: 06-01
    provides: Collection tables (collection_settings, collection_runs, sellers, etc.)
provides:
  - CollectionService with cost estimation and budget enforcement
  - REST API endpoints for collection run management
  - Startup recovery for interrupted runs
affects: [07-amazon-scraper, 08-ebay-discovery, admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Service class pattern (CollectionService) for business logic
    - Dependency injection via FastAPI Depends
    - Startup recovery in lifespan context manager

key-files:
  created:
    - apps/api/src/app/services/collection.py
    - apps/api/src/app/routers/collection.py
  modified:
    - apps/api/src/app/models.py
    - apps/api/src/app/main.py
    - apps/api/src/app/background.py
    - apps/api/src/app/routers/__init__.py

key-decisions:
  - "Placeholder cost estimation (50 products/category) for Phase 6 - Phase 7 will add real estimates"
  - "All collection endpoints require admin.automation permission"
  - "Budget enforcement blocks run creation if estimate exceeds cap (not just warning)"

patterns-established:
  - "CollectionService pattern: service class with supabase client injection"
  - "Run state machine: pending -> running -> (paused <-> running) -> completed/failed/cancelled"
  - "Startup recovery: one-time check in lifespan, logs for manual attention"

# Metrics
duration: 5min
completed: 2026-01-20
---

# Phase 6 Plan 2: Collection Service & API Summary

**CollectionService with cost estimation, budget enforcement, and REST endpoints for run lifecycle management**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-20T13:40:00Z
- **Completed:** 2026-01-20T13:45:00Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- Pydantic models for collection (CostEstimate, CollectionRunResponse, etc.)
- CollectionService with 13 async methods for run orchestration
- 10 REST endpoints for settings, estimation, and run CRUD
- Startup recovery detects interrupted runs on server boot

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Pydantic models for collection** - `3bf9bb2` (feat)
2. **Task 2: Create CollectionService** - `3f65103` (feat)
3. **Task 3: Create collection router with endpoints** - `99575c5` (feat)
4. **Task 4: Integrate router and background task** - `547b476` (feat)

## Files Created/Modified
- `apps/api/src/app/models.py` - Added 80 lines: CollectionRunStatus enum, CostEstimate, CollectionRunCreate/Response/ListResponse, EstimateRequest
- `apps/api/src/app/services/collection.py` - New: CollectionService with cost estimation, budget enforcement, run lifecycle, checkpointing
- `apps/api/src/app/routers/collection.py` - New: 10 REST endpoints for collection management
- `apps/api/src/app/routers/__init__.py` - Export collection_router
- `apps/api/src/app/main.py` - Include collection_router, call collection_startup_recovery
- `apps/api/src/app/background.py` - Add collection_startup_recovery function

## Decisions Made
- **Placeholder cost estimation:** Used 50 products/category placeholder. Phase 7 will replace with actual category product counts from the database.
- **Budget hard-block:** Create run returns 400 if estimated cost exceeds budget cap. No soft-warning-only mode - prevents accidental overspend.
- **admin.automation permission:** All collection endpoints require this permission, same as automation hub.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Migration 037_collection_infrastructure.sql must be run in Supabase SQL editor (documented in STATE.md pending todos).

## Next Phase Readiness
- Collection API ready for frontend integration
- Phase 06-03 (Collection UI) can now build admin dashboard
- Phase 7 (Amazon Scraper) will use CollectionService.checkpoint() for progress tracking

---
*Phase: 06-collection-infrastructure*
*Completed: 2026-01-20*
