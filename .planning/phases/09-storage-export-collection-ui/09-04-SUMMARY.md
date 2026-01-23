---
phase: 09-storage-export-collection-ui
plan: 04
subsystem: api
tags: [apscheduler, cron, scheduler, background-tasks, fastapi]

# Dependency graph
requires:
  - phase: 09-03
    provides: Collection UI components with templates and presets
provides:
  - APScheduler integration with AsyncIOScheduler
  - Cron-based collection schedule configuration
  - Schedule CRUD endpoints (GET/PATCH /collection/schedule)
  - Database persistence for schedules
  - Automatic schedule loading on API startup
affects: [09-05-scheduler-ui]

# Tech tracking
tech-stack:
  added: [apscheduler, croniter]
  patterns: [lifespan scheduler integration, cron validation]

key-files:
  created:
    - apps/api/src/app/services/scheduler.py
    - apps/api/migrations/042_collection_schedules.sql
  modified:
    - apps/api/pyproject.toml
    - apps/api/src/app/models.py
    - apps/api/src/app/routers/collection.py
    - apps/api/src/app/background.py
    - apps/api/src/app/main.py

key-decisions:
  - "APScheduler AsyncIOScheduler for non-blocking cron tasks"
  - "One schedule per org constraint for simplicity"
  - "Croniter for cron expression validation"
  - "1 hour misfire grace time for missed scheduled runs"
  - "Scheduled runs skip if collection already running"

patterns-established:
  - "Scheduler lifespan: start in lifespan startup, shutdown in teardown"
  - "Schedule persistence: database stores config, scheduler holds runtime state"

# Metrics
duration: 5min
completed: 2026-01-21
---

# Phase 9 Plan 4: Scheduler Infrastructure Summary

**APScheduler backend with cron-based collection scheduling, database persistence, and CRUD endpoints**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-21T00:00:00Z
- **Completed:** 2026-01-21T00:05:00Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- APScheduler integration with AsyncIOScheduler for non-blocking scheduled tasks
- Collection schedule CRUD endpoints with cron validation
- Database migration for schedule persistence across API restarts
- Scheduler lifecycle integration in FastAPI lifespan

## Task Commits

Each task was committed atomically:

1. **Task 1: Add APScheduler dependencies and create scheduler service** - `52e7678` (feat)
2. **Task 2: Create database migration for collection_schedules** - `7f09269` (feat)
3. **Task 3: Add schedule CRUD endpoints and models** - `56d7dc0` (feat)
4. **Task 4: Integrate scheduler into application lifecycle** - `dece94f` (feat)

## Files Created/Modified
- `apps/api/pyproject.toml` - Added apscheduler and croniter dependencies
- `apps/api/src/app/services/scheduler.py` - APScheduler service with load/add/remove schedule functions
- `apps/api/migrations/042_collection_schedules.sql` - Schedule configuration table with RLS
- `apps/api/src/app/models.py` - CollectionScheduleResponse and CollectionScheduleUpdate models
- `apps/api/src/app/routers/collection.py` - GET/PATCH /collection/schedule endpoints
- `apps/api/src/app/background.py` - scheduler_startup and scheduler_shutdown functions
- `apps/api/src/app/main.py` - Scheduler lifecycle in lifespan context manager

## Decisions Made
- Used APScheduler 3.x (not 4.x) for stability and AsyncIOScheduler support
- One schedule per organization constraint for MVP simplicity
- Cron validation via croniter before saving to database
- Scheduled runs automatically skip if collection already running (no queuing)
- 1 hour misfire grace time for missed scheduled runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**Migration required.** Add to pending todos:
- Run migration 042_collection_schedules.sql in Supabase SQL editor

## Next Phase Readiness
- Scheduler backend complete, ready for UI integration
- Schedule CRUD endpoints available for frontend consumption
- Plan 05 can build Scheduler Configuration UI

---
*Phase: 09-storage-export-collection-ui*
*Completed: 2026-01-21*
