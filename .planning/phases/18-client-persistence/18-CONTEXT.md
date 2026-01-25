# Phase 18: Client Persistence - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Cache data in IndexedDB for instant loads and incremental sync. This phase establishes the local storage layer with Dexie.js, sync state tracking via checkpoint cursors, and prefetch logic for predictive loading. UI indicators and offline queue are Phase 19 scope.

</domain>

<decisions>
## Implementation Decisions

### IndexedDB schema design
- Mirror server tables exactly (1:1 column mapping) — simpler sync logic
- Clear and re-sync on schema version changes — no migration handlers needed
- Tables to cache: Claude's discretion based on access patterns
- Indexes beyond primary keys: Claude's discretion based on query patterns

### Sync checkpoint strategy
- Per-table cursors — each table tracks its own last-synced updated_at independently
- Checkpoint storage location: Claude's discretion (Dexie patterns)
- Deleted record handling: Claude's discretion (based on Phase 15 soft delete decisions)
- Initial sync approach: Claude's discretion (use existing Phase 16 APIs)

### Cache-first behavior
- Always cache-first for reads — show local data immediately, sync in background
- Exceptions: mutations always hit server, dashboard totals/aggregates fetch fresh
- No UI indicator for cache vs fresh data — seamless experience
- Error recovery: clear and re-sync first, fallback to server-only mode if that fails

### Prefetch triggers
- Scroll position threshold — prefetch next page at 70-80% scroll position
- Prefetch depth: Claude's discretion based on record sizes
- Cancel on navigation: Claude's discretion based on navigation patterns
- Network awareness: Claude's discretion based on target use case

### Claude's Discretion
- Which tables to cache (likely seller_records at minimum)
- IndexedDB index selection for local queries
- Checkpoint storage mechanism (meta table vs localStorage)
- Soft delete handling locally (remove vs mark deleted)
- Initial sync using paginated API vs bulk endpoint
- Prefetch depth (1 page vs 2-3 pages)
- Prefetch cancellation behavior
- Network condition handling for prefetch

</decisions>

<specifics>
## Specific Ideas

- Use Dexie.js for IndexedDB (per ROADMAP.md success criteria)
- Clear-and-resync on version change keeps upgrade path simple
- Cache-first with background sync gives instant perceived performance
- Prefetch on scroll position (not immediate) balances UX vs bandwidth

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-client-persistence*
*Context gathered: 2026-01-24*
