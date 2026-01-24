---
phase: 15-server-storage-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, cursor-pagination, soft-delete, pg_cron, triggers]

# Dependency graph
requires:
  - phase: none
    provides: existing tables (bookkeeping_records, accounts, sellers)
provides:
  - updated_at columns with auto-update triggers on 3 syncable tables
  - deleted_at columns for soft delete on 3 syncable tables
  - Composite cursor indexes (scope_id, updated_at DESC, id DESC)
  - Partial indexes for active records (WHERE deleted_at IS NULL)
  - pg_cron purge job for 30-day soft delete retention
affects: [16-server-sync-api, 17-transport-layer, client-storage]

# Tech tracking
tech-stack:
  added: [pg_cron extension]
  patterns: [cursor-based pagination, soft delete with purge, composite indexes]

key-files:
  created:
    - apps/api/migrations/046_sync_infrastructure_columns.sql
    - apps/api/migrations/047_sync_infrastructure_indexes.sql
    - apps/api/migrations/048_sync_purge_job.sql
  modified: []

key-decisions:
  - "Reuse existing public.update_updated_at() function from 001_auth_schema.sql"
  - "Use CONCURRENTLY for all cursor indexes (safe for active tables)"
  - "30-day retention before purge, daily at 3 AM UTC"

patterns-established:
  - "Soft delete: Set deleted_at = NOW() triggers updated_at update for sync detection"
  - "Cursor index pattern: (scope_id, updated_at DESC, id DESC)"
  - "Partial index pattern: WHERE deleted_at IS NULL for active record queries"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 15 Plan 01: Sync Infrastructure Summary

**Database migrations for cursor-based sync: composite indexes, updated_at triggers, soft delete columns, and pg_cron purge job for 30-day retention**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T03:00:21Z
- **Completed:** 2026-01-24T03:03:37Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Added updated_at + deleted_at columns to bookkeeping_records and accounts tables
- Added deleted_at column and updated_at trigger to sellers table (already had updated_at column)
- Created composite cursor indexes for efficient O(log n) pagination on all 3 tables
- Created partial indexes for active record queries
- Set up pg_cron daily purge job for 30-day soft delete retention

## Task Commits

Each task was committed atomically:

1. **Task 1: Create column and trigger migration (046)** - `3c6b4f8` (feat)
2. **Task 2: Create composite index migration (047)** - `026d52f` (feat)
3. **Task 3: Create purge job migration (048)** - `dbf25ec` (feat)

## Files Created

- `apps/api/migrations/046_sync_infrastructure_columns.sql` - Adds updated_at/deleted_at columns and triggers
- `apps/api/migrations/047_sync_infrastructure_indexes.sql` - Composite cursor indexes and partial active indexes
- `apps/api/migrations/048_sync_purge_job.sql` - pg_cron extension and daily purge job

## Decisions Made

1. **Reuse existing trigger function** - Used `public.update_updated_at()` from 001_auth_schema.sql rather than creating per-table functions. Consistent with existing profiles/memberships pattern.

2. **CONCURRENTLY for all indexes** - All 3 tables (bookkeeping_records, accounts, sellers) could have existing data and are active tables. CONCURRENTLY prevents write locks during index creation.

3. **Cursor index column order** - `(scope_id, updated_at DESC, id DESC)` matches the query pattern for sync: filter by scope first, then order by timestamp with id as tiebreaker.

4. **Idempotent pg_cron scheduling** - Added exception handling for first-run case where cron.job table doesn't exist yet.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Database migrations require manual execution.** Run these migrations in Supabase SQL Editor in order:

1. `046_sync_infrastructure_columns.sql`
2. `047_sync_infrastructure_indexes.sql`
3. `048_sync_purge_job.sql`

Note: Migration 047 uses CONCURRENTLY which cannot run inside a transaction. Run each statement separately if batching fails.

## Next Phase Readiness

- Database infrastructure complete for cursor-based sync
- Tables ready for sync API endpoints (Phase 16)
- Columns and indexes in place, just need API layer to use them

---
*Phase: 15-server-storage-foundation*
*Completed: 2026-01-24*
