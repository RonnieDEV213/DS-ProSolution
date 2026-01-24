# Roadmap: DS-ProSolution v3

## Overview

v3 Storage & Rendering Infrastructure transforms DS-ProSolution from a full-fetch architecture that crashes at scale into a paginated, cached, virtualized system capable of handling millions of records across hundreds of eBay accounts. The roadmap follows a 4-layer architecture: server storage foundation with indexes and soft deletes, transport layer with cursor-based APIs, client storage with IndexedDB and sync engine, and virtualized rendering for smooth UI performance. Export/import capabilities round out the milestone with streaming support for large datasets.

## Milestones

- v1 Extension Auth & RBAC (Phases 1-7) - shipped 2026-01-20
- v2 SellerCollection (Phases 8-14) - shipped 2026-01-23
- **v3 Storage & Rendering Infrastructure (Phases 15-21)** - in progress

## Phases

<details>
<summary>v1 Extension Auth & RBAC (Phases 1-7) - SHIPPED 2026-01-20</summary>

See commit history for v1 implementation details.

</details>

<details>
<summary>v2 SellerCollection (Phases 8-14) - SHIPPED 2026-01-23</summary>

See commit history for v2 implementation details.

</details>

### v3 Storage & Rendering Infrastructure (In Progress)

**Milestone Goal:** Handle millions of records with fast read/write across server storage, transport, client storage, and rendering

- [x] **Phase 15: Server Storage Foundation** - Database indexes, updated_at triggers, soft deletes
- [ ] **Phase 16: Transport Layer** - Cursor-based pagination APIs with server-side filtering/sorting
- [ ] **Phase 17: Client Query Caching** - TanStack Query integration with stale-while-revalidate
- [ ] **Phase 18: Client Persistence** - IndexedDB schema with sync state tracking
- [ ] **Phase 19: Sync Protocol** - Sync status UI, optimistic updates, error handling, offline queue
- [ ] **Phase 20: Virtualized Rendering** - Virtual scroll, infinite scroll, keyboard navigation, filter UX
- [ ] **Phase 21: Export/Import** - Streaming export, background jobs, import validation

## Phase Details

### Phase 15: Server Storage Foundation
**Goal**: Database tables support efficient cursor-based queries with change tracking
**Depends on**: Nothing (first phase of v3)
**Requirements**: INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. All syncable tables have composite indexes for cursor pagination (e.g., `(account_id, sale_date DESC, id DESC)`)
  2. All syncable tables have `updated_at` column that auto-updates on row modification
  3. All syncable tables use soft deletes (`deleted_at`) instead of hard deletes
  4. Cursor queries execute in constant time regardless of page depth (verified via EXPLAIN ANALYZE)
**Plans**: 1 plan

Plans:
- [x] 15-01-PLAN.md - Sync infrastructure migrations (columns, indexes, purge job)

### Phase 16: Transport Layer
**Goal**: API endpoints support cursor-based pagination with server-side filtering and sorting
**Depends on**: Phase 15 (requires indexes for efficient queries)
**Requirements**: PAGI-01, PAGI-02, PAGI-03
**Success Criteria** (what must be TRUE):
  1. API returns opaque cursor for next page (not offset-based)
  2. API supports filter parameters that translate to indexed WHERE clauses
  3. API supports sort parameters that use indexed ORDER BY
  4. API returns consistent results when underlying data changes between pages
  5. API response includes total count (or estimate) for result summary
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md - Cursor pagination utilities and generic models
- [ ] 16-02-PLAN.md - Sync router with cursor-paginated endpoints

### Phase 17: Client Query Caching
**Goal**: Client uses TanStack Query for efficient server state management with automatic cache invalidation
**Depends on**: Phase 16 (requires paginated endpoints to cache)
**Requirements**: CACH-01, CACH-02, CACH-03
**Success Criteria** (what must be TRUE):
  1. List views use TanStack Query with stale-while-revalidate (instant loads from cache)
  2. Create/update/delete mutations automatically invalidate related list queries
  3. Cache persists in memory for session duration (no re-fetch on navigation)
  4. Duplicate requests within dedup window are merged (no redundant API calls)
**Plans**: TBD

Plans:
- [ ] 17-01: TanStack Query setup and query patterns
- [ ] 17-02: Mutation invalidation patterns

### Phase 18: Client Persistence
**Goal**: Client caches data in IndexedDB for instant loads and incremental sync
**Depends on**: Phase 17 (builds on TanStack Query patterns)
**Requirements**: INFR-04, INFR-05, CACH-04, CACH-05, CACH-06
**Success Criteria** (what must be TRUE):
  1. IndexedDB schema mirrors server data structure (Dexie.js)
  2. Sync engine tracks local vs server state (checkpoint cursors)
  3. Cache survives browser restart (data loads from IndexedDB before server)
  4. Incremental sync fetches only records changed since last sync (using updated_at)
  5. Next page prefetches while user views current page (predictive loading)
**Plans**: TBD

Plans:
- [ ] 18-01: IndexedDB schema and Dexie.js setup
- [ ] 18-02: Sync engine and incremental sync

### Phase 19: Sync Protocol
**Goal**: User has clear visibility into sync status with reliable error handling and offline resilience
**Depends on**: Phase 18 (requires IndexedDB and sync engine)
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, SYNC-08
**Success Criteria** (what must be TRUE):
  1. UI displays sync status indicator (syncing spinner, synced checkmark, error icon)
  2. UI shows "last synced X ago" timestamp
  3. Failed requests retry automatically with exponential backoff (max 3 retries)
  4. Errors display clear message with manual retry action
  5. Mutations update UI optimistically and rollback on error
  6. Conflicts show both versions for user resolution (not silent overwrite)
  7. Mutations queue when offline and sync when back online
  8. Each row displays individual sync status (synced/pending/error badge)
**Plans**: TBD

Plans:
- [ ] 19-01: Sync status UI components
- [ ] 19-02: Optimistic updates and error handling
- [ ] 19-03: Offline queue and conflict resolution

### Phase 20: Virtualized Rendering
**Goal**: Lists render millions of records smoothly with full UX features
**Depends on**: Phase 18 (requires IndexedDB data source for infinite scroll)
**Requirements**: PAGI-04, PAGI-05, PAGI-06, PAGI-07, PAGI-08, PAGI-09, PAGI-10
**Success Criteria** (what must be TRUE):
  1. Lists render using virtual scrolling with constant DOM elements (~50 visible rows)
  2. Lists display row count and result summary ("Showing 1-50 of 2,340,567")
  3. Lists show loading states during pagination and filtering (skeleton rows)
  4. Infinite scroll integrates with virtual scroll (seamless pagination trigger)
  5. User can save and load filter/view presets (persisted to backend)
  6. Common filters available as one-click quick filter chips
  7. Lists support keyboard navigation (j/k for rows, Enter to select)
**Plans**: TBD

Plans:
- [ ] 20-01: Virtualized table component (react-window)
- [ ] 20-02: Infinite scroll integration
- [ ] 20-03: Filter UX (presets, quick filters, keyboard nav)

### Phase 21: Export/Import
**Goal**: Users can export large datasets without browser crashes and import with validation
**Depends on**: Phase 16 (requires paginated endpoints for streaming)
**Requirements**: EXPO-01, EXPO-02, EXPO-03, EXPO-04, EXPO-05, EXPO-06, EXPO-07
**Success Criteria** (what must be TRUE):
  1. CSV export streams data (doesn't load all records into memory)
  2. Export UI allows column selection before export
  3. Export shows progress indicator with row count
  4. Large exports (>10K rows) run in background with notification when complete
  5. Export supports multiple formats (CSV, JSON, Excel, PDF)
  6. Import shows validation preview before committing (first 100 rows + errors)
  7. Import supports rollback to undo bad imports (within 24 hours)
**Plans**: TBD

Plans:
- [ ] 21-01: Streaming export (CSV, JSON)
- [ ] 21-02: Export UI and background jobs
- [ ] 21-03: Import validation and rollback

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Server Storage Foundation | v3 | 1/1 | Complete | 2026-01-24 |
| 16. Transport Layer | v3 | 0/2 | Planned | - |
| 17. Client Query Caching | v3 | 0/2 | Not started | - |
| 18. Client Persistence | v3 | 0/2 | Not started | - |
| 19. Sync Protocol | v3 | 0/3 | Not started | - |
| 20. Virtualized Rendering | v3 | 0/3 | Not started | - |
| 21. Export/Import | v3 | 0/3 | Not started | - |

---
*Roadmap created: 2026-01-23*
*Last updated: 2026-01-24*
