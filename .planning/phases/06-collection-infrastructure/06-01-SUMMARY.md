---
phase: 06-collection-infrastructure
plan: 01
subsystem: database
tags: [postgres, migrations, rls, collection, jobs, sellers]

# Dependency graph
requires:
  - phase: 05-presence-system
    provides: orgs table, auth.users references
provides:
  - collection_settings table for per-org budget configuration
  - collection_runs table for job state with checkpoint JSONB
  - collection_items table for per-item tracking
  - sellers table for deduplicated master list
affects: [06-02, 06-03, 07-amazon-scraping, 08-ebay-scraping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB checkpoint column for crash recovery"
    - "TEXT[] array for category_ids"
    - "CHECK constraint for status state machine"
    - "Normalized name with unique constraint for deduplication"

key-files:
  created:
    - apps/api/migrations/037_collection_infrastructure.sql
  modified: []

key-decisions:
  - "Budget cap in cents (2500 = $25) for integer arithmetic"
  - "Status CHECK constraint vs enum for easier migration"
  - "JSONB checkpoint for flexibility during API integration"
  - "Normalized name deduplication pattern for sellers"

patterns-established:
  - "Collection run state machine: pending -> running -> completed/failed/cancelled, with paused state"
  - "Per-item cost tracking for detailed budget analysis"
  - "ON DELETE SET NULL for optional run references in sellers"

# Metrics
duration: 2min
completed: 2026-01-20
---

# Phase 6 Plan 1: Collection Infrastructure Schema Summary

**PostgreSQL schema with 4 tables (settings, runs, items, sellers), 6-state job machine, JSONB checkpointing, and normalized seller deduplication**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-20T13:30:46Z
- **Completed:** 2026-01-20T13:32:11Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created collection_settings table for per-org budget cap, warning threshold, and max concurrent runs
- Created collection_runs table with 6-state machine, cost/progress tracking, and JSONB checkpoint
- Created collection_items table for per-item status, cost, and error tracking
- Created sellers table with normalized name uniqueness for deduplication
- Enabled RLS on all 4 tables with service_role bypass policies
- Added 9 indexes for query performance

## Task Commits

Each task was committed atomically:

1. **Task 1: Create collection infrastructure migration** - `386461e` (feat)

**Plan metadata:** Pending

## Files Created/Modified

- `apps/api/migrations/037_collection_infrastructure.sql` - Collection infrastructure schema with 4 tables, RLS, and indexes

## Decisions Made

- **Cents for money:** Using INT cents (2500 = $25) avoids floating point issues
- **CHECK vs ENUM for status:** CHECK constraint chosen for easier migration (no type creation)
- **JSONB for checkpoint:** Flexible structure allows different checkpoint formats per collection type
- **TEXT[] for category_ids:** Array type for efficient storage of selected categories
- **Normalized name pattern:** lowercase, stripped name for seller deduplication (handles "SELLER ABC" vs "seller abc")
- **ON DELETE SET NULL for seller run references:** Preserves seller data if run is deleted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Database migration required.** Run in Supabase SQL editor:

```sql
-- Execute migration 037_collection_infrastructure.sql
-- Creates: collection_settings, collection_runs, collection_items, sellers
```

## Next Phase Readiness

- Schema ready for collection service implementation (06-02)
- All foreign keys point to existing tables (orgs, auth.users)
- RLS policies allow service_role access for backend operations
- No blockers for next plan

---
*Phase: 06-collection-infrastructure*
*Completed: 2026-01-20*
