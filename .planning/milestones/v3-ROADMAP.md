# Milestone v3: Storage & Rendering Infrastructure

**Status:** SHIPPED 2026-01-25
**Phases:** 15-21
**Total Plans:** 23

## Overview

v3 Storage & Rendering Infrastructure transforms DS-ProSolution from a full-fetch architecture that crashes at scale into a paginated, cached, virtualized system capable of handling millions of records across hundreds of eBay accounts. The roadmap follows a 4-layer architecture: server storage foundation with indexes and soft deletes, transport layer with cursor-based APIs, client storage with IndexedDB and sync engine, and virtualized rendering for smooth UI performance. Export/import capabilities round out the milestone with streaming support for large datasets.

## Phases

### Phase 15: Server Storage Foundation

**Goal**: Database tables support efficient cursor-based queries with change tracking
**Depends on**: Nothing (first phase of v3)
**Plans**: 1 plan

Plans:
- [x] 15-01: Sync infrastructure migrations (columns, indexes, purge job)

**Details:**
- Added updated_at + deleted_at columns to bookkeeping_records, accounts, and sellers tables
- Created composite cursor indexes for efficient O(log n) pagination
- Created partial indexes for active record queries (WHERE deleted_at IS NULL)
- Set up pg_cron daily purge job for 30-day soft delete retention

### Phase 16: Transport Layer

**Goal**: API endpoints support cursor-based pagination with server-side filtering and sorting
**Depends on**: Phase 15 (requires indexes for efficient queries)
**Plans**: 2 plans

Plans:
- [x] 16-01: Cursor pagination utilities and generic models
- [x] 16-02: Sync router with cursor-paginated endpoints

**Details:**
- Created CursorPage model with URL-safe base64 cursors
- Implemented /sync/records, /sync/accounts, /sync/sellers endpoints
- Added include_deleted parameter for full sync scenarios
- Lightweight sync items without computed fields (client computes if needed)

### Phase 17: Client Query Caching

**Goal**: Client uses TanStack Query for efficient server state management with automatic cache invalidation
**Depends on**: Phase 16 (requires paginated endpoints to cache)
**Plans**: 2 plans

Plans:
- [x] 17-01: TanStack Query setup and query hooks
- [x] 17-02: Mutation hooks and bookkeeping migration

**Details:**
- Set up TanStack Query with 30s default staleTime, 5min for accounts
- Created mutation hooks for CRUD operations with automatic cache invalidation
- Migrated bookkeeping view from useState/useEffect to TanStack Query
- Implemented optimistic delete with rollback for instant UI feedback

### Phase 18: Client Persistence

**Goal**: Client caches data in IndexedDB for instant loads and incremental sync
**Depends on**: Phase 17 (builds on TanStack Query patterns)
**Plans**: 3 plans

Plans:
- [x] 18-01: IndexedDB schema and Dexie.js setup
- [x] 18-02: Sync engine and cache-first hooks
- [x] 18-03: Wire cache-first and prefetch hooks to UI

**Details:**
- Created IndexedDB schema using Dexie.js with version tracking
- Implemented sync engine with checkpoint cursors for incremental sync
- Bookkeeping page loads from IndexedDB cache before network
- Client-side computed fields (profit, earnings, COGS) calculated from raw data

### Phase 19: Sync Protocol

**Goal**: User has clear visibility into sync status with reliable error handling and offline resilience
**Depends on**: Phase 18 (requires IndexedDB and sync engine)
**Plans**: 6 plans (4 core + 2 gap closure)

Plans:
- [x] 19-01: Global sync status indicator (useOnlineStatus, useSyncStatus, SyncStatusIndicator)
- [x] 19-02: Optimistic updates and retry logic for mutation hooks
- [x] 19-03: Offline mutation queue and row-level sync badges
- [x] 19-04: Conflict detection and resolution modal
- [x] 19-05: Wire offline queueing into mutation hooks (gap closure: SYNC-07)
- [x] 19-06: Fix conflict detection data source (gap closure: SYNC-06)

**Details:**
- UI displays sync status indicator (syncing spinner, synced checkmark, error icon)
- Failed requests retry automatically with exponential backoff (max 3 retries)
- Mutations update UI optimistically and rollback on error
- Conflicts show both versions for user resolution (not silent overwrite)
- Mutations queue when offline and sync when back online
- Each row displays individual sync status (synced/pending/error badge)

### Phase 20: Virtualized Rendering

**Goal**: Lists render millions of records smoothly with full UX features
**Depends on**: Phase 18 (requires IndexedDB data source for infinite scroll)
**Plans**: 5 plans

Plans:
- [x] 20-01: Virtualized table core (react-window v2, row density, skeleton rows)
- [x] 20-02: Infinite scroll integration and keyboard navigation
- [x] 20-03: Quick filter chips and scroll restoration
- [x] 20-04: Infinite scroll pagination wiring (gap closure)
- [x] 20-05: UAT fixes: row click expand, granular filter chips (gap closure)

**Details:**
- Lists render using virtual scrolling with constant DOM elements (~50 visible rows)
- Row count and result summary displayed ("Showing 1-50 of 2,340,567")
- Loading states during pagination and filtering (skeleton rows)
- Infinite scroll integrates with virtual scroll (seamless pagination trigger)
- Common filters available as one-click quick filter chips
- Keyboard navigation (j/k for rows, Enter to select)

### Phase 21: Export/Import

**Goal**: Users can export large datasets without browser crashes and import with validation
**Depends on**: Phase 16 (requires paginated endpoints for streaming)
**Plans**: 4 plans

Plans:
- [x] 21-01: Backend export infrastructure (streaming endpoints + background jobs)
- [x] 21-02: Frontend export UI (column selection, progress, notifications)
- [x] 21-03: Backend import infrastructure (validation, batch tracking, rollback)
- [x] 21-04: Frontend import UI (column mapping, preview, history)

**Details:**
- CSV export streams data (doesn't load all records into memory)
- Export UI allows column selection with presets (Essential, Financial, All)
- Large exports (>10K rows) run in background with notification when complete
- Export supports multiple formats (CSV, JSON, Excel)
- Import shows validation preview before committing
- Import supports rollback to undo bad imports (within 24 hours)

---

## Milestone Summary

**Key Decisions:**

| Decision | Rationale |
|----------|-----------|
| Reuse public.update_updated_at() | Existing function from 001_auth_schema.sql, consistent pattern |
| URL-safe base64 cursors | Short cursors for query parameters, URL-safe characters |
| 30s staleTime, 5min for accounts | Records change frequently, accounts rarely |
| SCHEMA_VERSION triggers full resync | Simpler than migration handlers |
| useSyncExternalStore for online/offline | Proper cleanup, SSR-safe browser event subscription |
| Temp ID format temp-{uuid} | Easy identification of uncommitted records |
| 10K row threshold for background exports | Streaming for smaller exports, background jobs for larger |
| 70% similarity for column mapping | Balances flexibility with accuracy for import |
| 24-hour rollback window | Per requirements, enforced in code and DB function |

**Issues Resolved:**
- Full-fetch architecture causing browser crashes at scale
- No client-side caching (every navigation re-fetched)
- Basic indexes without pagination support
- Missing offline resilience for mutations
- No conflict resolution for concurrent edits

**Technical Debt Incurred:**
- Export PAGI-08 (filter presets) deferred to future milestone
- PDF export deferred to future milestone

---

*For current project status, see .planning/ROADMAP.md*
