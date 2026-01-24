# Project Research Summary

**Project:** DS-ProSolution v3 Large-Scale Data Infrastructure
**Domain:** eBay account management platform with multi-million record data pipeline
**Researched:** 2026-01-23
**Confidence:** HIGH

## Executive Summary

DS-ProSolution v3 addresses a fundamental scaling problem: the current "full-fetch" pattern crashes when handling millions of records across hundreds of eBay accounts. The research converges on a 4-layer architecture: PostgreSQL with keyset pagination at the server, REST API with cursor-based endpoints, IndexedDB (via Dexie.js) for client-side caching, and virtualized rendering for the UI. This is not a novel architecture but rather a well-established pattern for large-scale data applications, with extensive documentation and production-proven libraries available.

The recommended approach prioritizes incremental adoption. Start with cursor-based pagination at the API layer (replacing offset pagination), add TanStack Query for server state management, then layer in IndexedDB for offline-capable caching, and finally implement virtualization for smooth UI performance. Each layer can be added independently, allowing the team to ship value incrementally while building toward the full architecture.

The critical risks are well-understood and preventable. Non-unique cursor columns cause duplicate/missing records (use compound cursors). IndexedDB transactions auto-commit during async operations (fetch data before opening transactions). Safari evicts storage after 7 days of inactivity (design for re-sync, not permanent cache). These are not exotic edge cases but documented pitfalls with established prevention patterns.

## Key Findings

### Recommended Stack

The stack recommendation prioritizes technologies that integrate cleanly with the existing Supabase/PostgreSQL backend and Next.js 14+ frontend. All recommendations are verified against official documentation and production usage.

**Core technologies:**

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Keyset Pagination | PostgreSQL native | Navigate large datasets | Offset pagination degrades 17x at scale; keyset maintains constant O(log n) performance |
| Dexie.js | 4.2.x | IndexedDB wrapper | Best developer experience, excellent React hooks (`useLiveQuery`), handles browser-specific bugs, 100K+ production sites |
| TanStack Query | 5.x | Server state management | De facto React standard for caching, deduplication, background refetch, optimistic updates |
| Supabase Cache Helpers | 1.x | TanStack + Supabase integration | Auto-generates cache keys, handles mutations, cursor pagination hooks built-in |
| Custom Incremental Sync | Custom | Client-server sync | Full control, no vendor lock-in, works within existing Supabase ecosystem |

**Why NOT alternatives:**
- RxDB: Overkill complexity, larger bundle, unnecessary CRDT features
- PowerSync/Electric SQL: Adds infrastructure; Supabase already handles what we need
- Offset pagination: Performance degrades linearly with page depth
- Raw IndexedDB: Verbose, callback-based, no schema migrations

### Expected Features

**Must have (table stakes):**
- Cursor-based pagination API (foundation for scale)
- Server-side filtering and sorting (cannot do client-side at millions of records)
- Virtual scrolling (prevent DOM crashes with 10K+ rows)
- TanStack Query caching with stale-while-revalidate
- Loading states with determinate progress for long operations
- Sync status indicator with last-synced timestamp
- Cache invalidation on mutations (lists must update after create/edit/delete)

**Should have (competitive):**
- Optimistic updates for sub-second mutation feedback
- Streaming CSV export for large datasets
- Saved views/filters for VA productivity
- Quick filters (one-click common filter presets)

**Defer (v2+):**
- IndexedDB persistence across browser restarts (session cache sufficient initially)
- Full incremental sync protocol (paginated full refresh acceptable for MVP)
- Infinite scroll + virtual scroll hybrid
- Conflict resolution UI (last-write-wins acceptable for internal tool)
- Offline mutation queue (users have reliable connectivity)

### Architecture Approach

The architecture follows a 4-layer pattern where each layer has clear responsibilities and data flows downward through well-defined interfaces. Server storage (PostgreSQL) is authoritative with optimized indexes for cursor queries. The transport layer (FastAPI) provides cursor-based pagination and delta sync endpoints. Client storage (IndexedDB via Dexie.js) caches synced data locally with mutation queue for offline resilience. The rendering layer (React with virtualization) displays only visible rows while integrating with pagination triggers.

**Major components:**

1. **Server Storage (PostgreSQL/Supabase)** -- Authoritative data store with `updated_at` tracking, soft deletes, composite indexes for cursor pagination, RLS for multi-tenant security
2. **Transport API (FastAPI)** -- `GET /records/paginated` with opaque cursor, `GET /records/sync` for delta fetch, `POST /records/bulk` for batched mutations
3. **Client Storage (Dexie.js IndexedDB)** -- `records` table mirroring server, `syncState` for checkpoint tracking, `pendingMutations` for offline queue
4. **Sync Engine** -- State machine: IDLE -> CHECK_STATE -> INITIAL_SYNC or DELTA_SYNC -> PUSH_MUTATIONS -> IDLE
5. **Rendering Layer (React + react-window)** -- Virtualized table with `useLiveQuery()` for reactive updates, `InfiniteLoader` for pagination triggers

### Critical Pitfalls

The research identified 5 critical pitfalls that cause rewrites or major architectural issues if not addressed early:

1. **Non-Unique Cursor Columns (CP-01)** -- Using `updated_at` alone causes duplicates when rows share timestamps. Prevention: Always use compound cursors `(updated_at, id)` with matching compound index.

2. **IndexedDB Transaction Auto-Commit (CP-02)** -- Any `await` to external API inside a transaction causes `TransactionInactiveError`. Prevention: Fetch all data BEFORE opening transaction, then write in single transaction.

3. **Safari 7-Day Storage Eviction (CP-03)** -- Safari deletes all IndexedDB after 7 days of inactivity. Prevention: Design for re-sync from server; cache is performance optimization, not permanent storage.

4. **Optimistic Update Rollback Races (CP-04)** -- Overlapping optimistic updates create inconsistent UI on rollback. Prevention: Sequence mutations, use mutation queue, cancel in-flight requests before applying new changes.

5. **IndexedDB Schema Migration Conflicts (CP-05)** -- Multi-tab scenario blocks database upgrades. Prevention: Handle `onversionchange` to close database, handle `onblocked` with user prompt.

## Implications for Roadmap

Based on research, suggested 4-phase structure following the layer dependencies:

### Phase 1: Pagination Infrastructure (Server Foundation)

**Rationale:** Everything else depends on efficient server-side data access. Cannot add client caching or sync until the API supports cursor-based pagination. This phase has zero dependencies.

**Delivers:**
- `updated_at` and `deleted_at` columns on syncable tables
- Composite indexes for cursor pagination `(account_id, sale_date DESC, id DESC)`
- Auto-update trigger for `updated_at`
- `GET /records/paginated` endpoint with opaque cursor
- `GET /records/sync` endpoint for delta fetch

**Features addressed:** Cursor-based pagination, server-side filtering, server-side sorting
**Pitfalls avoided:** CP-01 (compound cursors), PT-01 (missing index), PT-05 (DESC performance), SP-03 (Supabase client tuple comparison)

### Phase 2: Client Caching Layer (IndexedDB Foundation)

**Rationale:** With server endpoints ready, can now build client-side caching. This enables offline reads and instant subsequent loads. Requires Phase 1 endpoints to sync with.

**Delivers:**
- Dexie.js database schema mirroring key tables
- Sync state tracking (checkpoints, cursors)
- Pending mutation queue for offline writes
- TanStack Query integration for server state
- Basic sync engine (initial sync + delta sync)

**Uses:** Dexie.js 4.2.x, TanStack Query 5.x, Supabase Cache Helpers
**Pitfalls avoided:** CP-02 (transaction auto-commit), CP-03 (Safari eviction), CP-05 (schema migration), PT-03 (write bottleneck via batching)

### Phase 3: Sync Protocol (Data Consistency)

**Rationale:** With storage layers complete, can now implement the sync protocol that ties them together. Handles the complex state machine of initial sync, delta sync, and mutation push.

**Delivers:**
- Complete sync engine state machine
- Optimistic update handling with rollback
- Conflict resolution (last-write-wins with timestamp)
- Error recovery and retry logic
- Sync status UI indicators

**Features addressed:** Sync status indicator, optimistic updates, retry on failure, error states
**Pitfalls avoided:** CP-04 (optimistic rollback races), TD-02 (offline strategy), TD-04 (version vectors), SP-02 (realtime subscription overhead)

### Phase 4: Virtualized Rendering (UI Performance)

**Rationale:** Final layer brings efficient rendering. Requires IndexedDB data source to read from. This phase transforms the UI to handle millions of records smoothly.

**Delivers:**
- Virtualized table component with react-window
- Infinite loader integration for seamless pagination
- Focus/accessibility management for virtualized content
- Complete integration replacing existing RecordsTable
- Memory management with maxPages configuration

**Features addressed:** Virtual scrolling, loading states, configurable page size
**Pitfalls avoided:** PT-02 (unbounded memory growth), PT-04 (focus/accessibility), TD-03 (virtualization integration)

### Phase Ordering Rationale

1. **Layer dependencies are strict:** API must exist before client can sync; IndexedDB must exist before virtualization can read from it. Violating this order creates blocking dependencies mid-phase.

2. **Each phase delivers standalone value:** Phase 1 immediately improves API performance. Phase 2 adds caching benefits. Phase 3 adds reliability. Phase 4 adds UI smoothness. No wasted work if scope changes.

3. **Pitfall distribution guides complexity:** Critical pitfalls cluster in Phase 1 (pagination) and Phase 2 (IndexedDB). Addressing these early prevents architectural rework. Phase 3-4 pitfalls are more recoverable.

4. **Testing strategy aligns:** Each phase can be tested independently. Server endpoints can be verified before client work begins. Sync engine can be tested with mock endpoints.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3 (Sync Protocol):** Optimistic update rollback handling is complex; may need spike to validate TanStack Query's built-in optimistic update patterns work for our mutation patterns
- **Phase 4 (Virtualization):** Accessibility with virtualized lists is tricky; may need prototype to validate focus management approach

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Pagination):** Well-documented PostgreSQL patterns, FastAPI pagination library exists, Supabase examples available
- **Phase 2 (IndexedDB):** Dexie.js documentation is comprehensive, patterns are established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with official docs, production usage confirmed, versions pinned |
| Features | MEDIUM-HIGH | Table stakes well-documented; differentiator complexity estimates are experience-based |
| Architecture | HIGH | 4-layer pattern is established for offline-capable apps; multiple reference implementations |
| Pitfalls | HIGH | All critical pitfalls documented with multiple authoritative sources; prevention patterns are clear |

**Overall confidence:** HIGH

The v3 data infrastructure is not novel technology. The patterns are well-established, the libraries are mature, and the pitfalls are documented. Risk comes from implementation complexity, not from uncertainty about the approach.

### Gaps to Address

- **Performance targets validation:** The research cites targets (<1s initial load, <5s for 10K record sync) but these should be validated with production data volumes during Phase 1
- **Chrome extension specifics:** The research notes MV3 service workers support IndexedDB but the extension's sync requirements need clarification during planning
- **Multi-account sync orchestration:** The sync engine handles single-account sync but orchestrating across hundreds of accounts needs design work
- **Export at scale:** Streaming CSV export is recommended but the exact implementation (server-side vs client-side) needs decision during Phase 3/4

## Sources

### Primary (HIGH confidence)
- [Dexie.js Official Documentation](https://dexie.org/) -- IndexedDB wrapper, React hooks, schema migrations
- [TanStack Query v5 Docs](https://tanstack.com/query/latest) -- Server state, infinite queries, optimistic updates
- [Supabase Cache Helpers](https://supabase-cache-helpers.vercel.app/) -- TanStack + Supabase integration
- [PostgreSQL Keyset Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) -- Cursor pagination patterns
- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) -- Browser storage API

### Secondary (MEDIUM confidence)
- [Sentry Pagination at Scale](https://blog.sentry.io/paginating-large-datasets-in-production-why-offset-fails-and-cursors-win/) -- Production experience with cursor pagination
- [RxDB IndexedDB Limits](https://rxdb.info/articles/indexeddb-max-storage-limit.html) -- Storage eviction, Safari 7-day limit
- [TkDodo Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query) -- Concurrent optimistic update handling
- [Citus Data Pagination](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/) -- PostgreSQL pagination patterns

### Tertiary (LOW confidence - verify before implementation)
- 40-60% faster perceived load with offline-first (survey data, not independently verified)
- IndexedDB sharding provides 28% faster reads (single benchmark source)

---
*Research completed: 2026-01-23*
*Ready for roadmap: yes*
