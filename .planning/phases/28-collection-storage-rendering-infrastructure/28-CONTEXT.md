# Phase 28: Collection Storage & Rendering Infrastructure - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing v3 bookkeeping infrastructure (cursor-based pagination, TanStack Query caching, IndexedDB persistence, incremental sync, virtualized rendering, streaming export) into the collection feature. Replace direct `fetch()` + `useState` with the cache-first, offline-capable architecture already proven in bookkeeping. The sellers dataset is expected to be the largest in the app (5k after one day, projected 50-100k+).

</domain>

<decisions>
## Implementation Decisions

### Data Persistence Scope
- **Sellers**: Full IndexedDB persistence with incremental sync (Dexie `sellers` table already exists)
- **Collection run history**: Persist in IndexedDB for instant load and offline access, sync incrementally
- **Manual edit audit logs**: Persist in IndexedDB alongside run history (displayed together in history panel)
- **Worker activity logs & metrics**: Ephemeral — memory only during active runs, discarded on unmount
- **Initial sync strategy**: Claude's Discretion — balance first-load speed with completeness (progressive sync preferred given 50-100k+ scale)

### Real-time vs Sync Interaction
- **New sellers during active runs**: SSE pushes new seller data so they appear in real-time during the run, not just after completion
- **New seller visual treatment**: Brief highlight animation when new sellers appear in the grid, fading after a few seconds
- **Polling migration**: Migrate `useCollectionPolling` to TanStack Query with `refetchInterval` for automatic retry, caching, and devtools integration
- **SSE lifecycle**: Claude's Discretion — decide whether to keep current behavior (connect on active run, disconnect on timeout) or keep alive while automation page is open
- **Post-run sync**: Auto-sync on run complete — trigger incremental sync to pull merged seller list into IndexedDB automatically

### SellersGrid Migration
- **Data loading**: Windowed data loading — only visible rows + buffer loaded from IndexedDB, not full dataset in memory (critical at 50-100k+ scale)
- **Search/filter**: Debounced Dexie query (300ms) — query IndexedDB directly with indexes on searchable fields
- **Undo/redo**: Simplify to single-level undo (last action only) — multi-step redo adds complexity with windowed data and is rarely used
- **Drag-select & flag painting**: Visible-only scope — interactions affect what's on screen, users scroll and repeat (standard grid behavior)

### Export Behavior
- **Formats**: CSV, JSON, and copy-to-clipboard
- **Copy format**: One seller name per line, newline-separated
- **Export scope**: Respects current filters + selection — if sellers selected, export those; if filtered, export filtered set; otherwise export all
- **All columns included**: Export all seller fields (display_name, normalized_name, platform, times_seen, feedback_percent, feedback_count, flagged, platform_id, created_at)
- **Flag on export**: Preserved — exporting sellers marks them as flagged in IndexedDB + syncs to server
- **Export threshold**: Claude's Discretion — pick threshold for streaming vs background job based on seller record complexity

### Conflict Resolution & Concurrency
- **Edit conflicts**: Last write wins — most recent change overwrites. No conflict modal for sellers (simple data, minor edits)
- **Concurrent runs**: Allow parallel collection runs — multiple users can run simultaneously
- **Run visibility**: Each user sees only their own run's progress; other runs invisible until completed
- **Deduplication**: Reuse existing server-side dedup mechanism — `normalized_name + platform` uniqueness, app-level check before insert + DB UNIQUE constraint as safety net. No second dedup system.
- **Merge behavior**: Both runs send found sellers to server, server deduplicates on insert (existing sellers get `times_seen`/`last_seen_run_id` updated, only genuinely new sellers inserted). Sync pulls merged result automatically on run complete.

### Claude's Discretion
- Initial sync strategy (progressive vs full on mount)
- SSE connection lifecycle policy
- Export streaming vs background job threshold
- ON CONFLICT DO UPDATE tightening for concurrent worker race conditions
- Dexie index design for windowed queries
- Buffer size for windowed data loading

</decisions>

<specifics>
## Specific Ideas

- Sellers will be the largest dataset in the app — 5k after one day of running, projected 50-100k+. All architecture decisions should account for this scale.
- Keep dedup consistent and reusable — don't introduce a second dedup system. The existing server-side `normalized_name + platform` mechanism handles concurrent runs naturally.
- Copy-to-clipboard is simple newline-separated seller names, not tab-delimited or CSV format.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-collection-storage-rendering-infrastructure*
*Context gathered: 2026-01-27*
