---
phase: 18-client-persistence
plan: 01
subsystem: database
tags: [dexie, indexeddb, react, sync, cache]

# Dependency graph
requires:
  - phase: 16-sync-api
    provides: Cursor-based sync endpoints for records, accounts, sellers
  - phase: 17-client-query-caching
    provides: QueryProvider and React Query patterns
provides:
  - IndexedDB database singleton with Dexie.js
  - Typed schema for accounts, records, sellers, sync_meta
  - DatabaseProvider for app initialization
  - Sync API client methods
affects: [18-02-sync-engine, 19-offline-ux]

# Tech tracking
tech-stack:
  added: [dexie@4.2.1, dexie-react-hooks@4.2.0, react-intersection-observer@10.0.2]
  patterns: [database singleton pattern, schema version migration via clear-and-resync]

key-files:
  created:
    - apps/web/src/lib/db/schema.ts
    - apps/web/src/lib/db/index.ts
    - apps/web/src/lib/db/init.ts
    - apps/web/src/components/providers/database-provider.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/lib/api.ts

key-decisions:
  - "SCHEMA_VERSION increment triggers full resync - simpler than migrations"
  - "Compound index [account_id+sale_date] for efficient record queries"
  - "_sync_meta table for per-table checkpoint tracking"
  - "DatabaseProvider renders null briefly until DB ready"

patterns-established:
  - "Database singleton: import { db } from @/lib/db"
  - "Schema types in separate file for reuse"
  - "Version check via localStorage key"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 18 Plan 01: IndexedDB Setup Summary

**Dexie.js IndexedDB singleton with typed schema mirroring server tables, initialization provider, and sync API client methods**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T12:00:00Z
- **Completed:** 2026-01-24T12:04:00Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- Installed Dexie.js, dexie-react-hooks, and react-intersection-observer
- Created typed IndexedDB schema matching server models exactly
- Database singleton with compound indexes for efficient queries
- DatabaseProvider initializes DB on app load with graceful fallback
- Sync API methods (syncRecords, syncAccounts, syncSellers) with typed responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Dexie.js and dependencies** - `8851511` (chore)
2. **Task 2: Create Dexie database singleton with typed schema** - `da26c6a` (feat)
3. **Task 3: Create DatabaseProvider and wire to app layout** - `c4771a7` (feat)
4. **Task 4: Add sync API client methods** - `437f04d` (feat)

## Files Created/Modified
- `apps/web/package.json` - Added dexie, dexie-react-hooks, react-intersection-observer
- `apps/web/src/lib/db/schema.ts` - TypeScript interfaces for IndexedDB tables
- `apps/web/src/lib/db/index.ts` - Dexie database singleton with indexed columns
- `apps/web/src/lib/db/init.ts` - Database initialization with version check
- `apps/web/src/components/providers/database-provider.tsx` - React provider for DB init
- `apps/web/src/app/layout.tsx` - Wrapped children with DatabaseProvider
- `apps/web/src/lib/api.ts` - Added SyncParams, SyncResponse, sync methods

## Decisions Made
- **SCHEMA_VERSION approach:** Increment to trigger full clear and resync rather than complex migrations
- **Compound index [account_id+sale_date]:** Optimizes the primary query pattern for records
- **_sync_meta table:** Stores per-table checkpoints (e.g., "records:account-123")
- **Graceful fallback:** DatabaseProvider still renders app if IndexedDB fails

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- IndexedDB foundation ready for sync engine implementation
- Sync API client methods ready for background sync
- Plan 18-02 can implement incremental sync using _sync_meta checkpoints

---
*Phase: 18-client-persistence*
*Completed: 2026-01-24*
