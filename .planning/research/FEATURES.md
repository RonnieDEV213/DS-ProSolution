# Feature Landscape: Large-Scale Data Infrastructure

**Domain:** Data pipeline for eBay account management (millions of records)
**Researched:** 2026-01-23
**Overall Confidence:** MEDIUM-HIGH

## Table Stakes

Features users expect. Missing = product feels incomplete or broken at scale.

### Large Dataset Browsing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cursor-based pagination | Offset pagination fails at scale (DB scans all preceding rows). Users expect consistent performance regardless of page depth. | Medium | Server-side, index-backed. [Sentry confirms](https://blog.sentry.io/paginating-large-datasets-in-production-why-offset-fails-and-cursors-win/) offset degrades linearly. |
| Server-side filtering | Client can't filter millions of rows. Users expect sub-second filter response. | Medium | Push filtering to DB with proper indexes. |
| Server-side sorting | Same as filtering - client can't sort millions of rows in memory. | Medium | DB-level sort with index support. |
| Virtual scrolling | Rendering 10K+ DOM nodes crashes browsers. Users expect smooth scrolling through large lists. | Medium | TanStack Virtual or similar. Constant DOM elements regardless of data size. |
| Row count / result summary | Users need context: "Showing 1-50 of 2,340,567 results". | Low | Can be expensive to compute for huge datasets - consider caching or async count. |
| Configurable page size | Different contexts need different densities (quick scan vs detailed review). Standard options: 10, 25, 50, 100. | Low | Default to 25-50 rows per page per [UX research](https://uxpatterns.dev/patterns/data-display/table). |
| Loading states | Users need to know system is working. "Is it frozen or loading?" | Low | Determinate progress for 3-10s operations, indeterminate for <3s. |

### Client-Side Caching

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Basic query caching | Re-fetching identical data on every navigation feels broken. Users expect instant back-button. | Low | TanStack Query provides this out of the box. |
| Stale-while-revalidate | Show cached data immediately, refresh in background. Users see instant UI with fresh data arriving. | Low | SWR pattern - TanStack Query default behavior. |
| Cache invalidation on mutation | After user creates/edits/deletes, list must reflect change. Stale data after mutation = broken UX. | Medium | [TanStack Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) - query key factory pattern recommended. |
| Session persistence | Navigating away and back shouldn't re-fetch everything. Cache should survive within session. | Low | Memory cache sufficient for session. |

### Sync UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sync status indicator | Users need to know if data is current, syncing, or stale. [Google Drive pattern](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback). | Low | Subtle when auto-syncing, prominent when action needed. |
| Last synced timestamp | "Data from 5 minutes ago" gives users confidence context. | Low | Store and display last successful fetch time. |
| Retry on failure | Network failures happen. Users expect automatic retry with exponential backoff. | Low | TanStack Query has built-in retry logic. |
| Error states with recovery | When sync fails, users need clear error message and retry action. | Low | Toast + retry button, not just silent failure. |
| Optimistic updates | For mutations, update UI immediately, rollback on error. Sub-second feedback for user actions. | Medium | Critical for perceived performance. |

### Export/Import

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSV export | Universal format, everyone expects it. | Medium | Streaming for large datasets - don't load millions of rows into memory. |
| Column selection for export | Users rarely need all 50 columns. Let them pick relevant ones. | Low | UI for column selection before export. |
| Export progress indicator | Large exports take time. Users need feedback that export is working. | Low | Determinate progress bar showing row count / total. |
| Export size limits / chunking | Single 10M row export will crash browser or timeout. | Medium | Server-side streaming or background job with download link. |

## Differentiators

Features that set product apart. Not expected but valued when present.

### Large Dataset Browsing

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Infinite scroll + virtual scroll hybrid | Best of both: smooth continuous browsing (no page clicks) + constant DOM performance. | High | Combines [TanStack Virtual](https://tanstack.com/virtual) with pagination API. "Paged infinite virtual scrolling" pattern. |
| Saved views / filters | VAs work with same filter sets repeatedly. Save time by persisting filter configurations. | Medium | Store per-user filter presets. Big productivity gain for repetitive workflows. |
| Quick filters / faceted navigation | Common filters as one-click chips (e.g., "Awaiting Shipment", "Today's Orders"). | Medium | Pre-defined filter shortcuts for common workflows. |
| Real-time updates via SSE/WebSocket | Data updates without manual refresh. See new orders appear as they come in. | High | Already have SSE infrastructure from v2. Can extend to order streams. |
| Keyboard navigation | Power users can browse/select without mouse. j/k for rows, Enter to select. | Medium | Accessibility bonus, productivity win for VAs. |
| Multi-level sorting | Sort by date, then by status, then by amount. Complex data needs complex sorting. | Medium | UI for defining sort priority order. |

### Client-Side Caching

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| IndexedDB persistence | Cache survives browser restart. App loads instantly with cached data, syncs in background. | High | [2025 trend](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/): full DBs in browser. Significant complexity but 40-60% faster perceived load. |
| Incremental sync protocol | Only fetch changed records since last sync, not full dataset. Massive bandwidth savings. | High | Requires server-side change tracking (timestamps, version vectors). |
| Background sync with service worker | Sync data even when tab is inactive. Data is fresh when user returns. | High | Service worker + Background Sync API. Overkill for internal tool? |
| Predictive prefetching | Prefetch next page while user is on current page. Instant pagination. | Medium | Predict user navigation patterns, prefetch likely next queries. |

### Sync UX

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conflict resolution UI | When same record edited in multiple places, show both versions and let user decide. | High | Most apps use "last write wins". Explicit resolution = premium feature. |
| Offline queue with retry | Queue mutations when offline, sync when online. Never lose user work. | High | Requires careful state management, conflict handling. |
| Per-record sync status | See which specific records are syncing, failed, or stale. Not just global status. | Medium | Badge or icon per row showing sync state. |
| Sync pause/resume | Let user pause background sync (bandwidth concerns, focus mode). | Low | Toggle in settings, not commonly expected. |

### Export/Import

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Background export with notification | User initiates large export, continues working, gets notified when ready. | High | Background job, download link in notification. |
| Scheduled exports | Auto-export daily/weekly to email or cloud storage. | High | Cron job, storage integration. Overkill for internal tool? |
| Multiple formats (CSV, JSON, Excel, PDF) | Different stakeholders need different formats. Clients want Excel, devs want JSON. | Medium | Already have CSV/JSON from v2. Excel and PDF are nice-to-have. |
| Import with validation preview | Preview import results, see errors before committing. Prevents bad data entry. | High | Parse, validate, show preview, then insert. Complex but valuable. |
| Import rollback | Undo a bad import. Safety net for large data operations. | High | Track import batch, provide rollback action. |

## Anti-Features

Features to explicitly NOT build. Common mistakes or overkill for this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Offline-first as core architecture | Overkill for internal agency tool with reliable connectivity. Adds massive complexity. | Cache-first for performance, but assume online. Queue mutations briefly, don't build full offline mode. |
| Real-time collaborative editing | Not a document editor. Multiple VAs shouldn't edit same record simultaneously. | Lock record while editing, or last-write-wins with notification. |
| CRDTs for conflict resolution | Academic solution for distributed systems. Too complex for internal tool. | Last-write-wins with timestamp. Manual conflict resolution only if absolutely needed. |
| Full-text search at scale | Building custom search infrastructure is expensive. Not the core value of this app. | Use Supabase full-text search or external service (Algolia) if needed. Don't build from scratch. |
| GraphQL for pagination | REST with cursor pagination is simpler and sufficient. GraphQL adds complexity without benefit here. | Stick with REST + cursor-based pagination. |
| Client-side data transformation | Don't transform millions of rows in browser. | Push aggregation, filtering, and transformation to server/database. |
| Infinite scroll without virtual scroll | Memory will grow unbounded. Will crash at scale. | Always pair infinite scroll with virtualization. |
| "Load all" option for large datasets | Users will click it, browser will crash, they'll blame the app. | Cap at 10K or remove option. Server-side export for full dataset. |
| Custom scrollbar implementations | Fighting the browser is painful. Custom scrollbars break accessibility and feel wrong. | Use native scrollbars with virtualization. |
| Aggressive prefetching | Prefetching too much wastes bandwidth and can slow down actual user requests. | Prefetch one page ahead at most. Respect data caps. |

## Feature Dependencies

```
Server-side pagination (cursor-based)
    |
    +---> Virtual scrolling (needs paginated data source)
    |       |
    |       +---> Infinite scroll hybrid (needs virtual scrolling working first)
    |
    +---> Server-side filtering (same API pattern)
    |
    +---> Server-side sorting (same API pattern)

TanStack Query setup
    |
    +---> Basic caching (automatic)
    |
    +---> Cache invalidation (query key factory)
    |       |
    |       +---> Optimistic updates (needs invalidation working)
    |
    +---> Stale-while-revalidate (configuration)

IndexedDB layer (if building)
    |
    +---> Incremental sync (needs local storage)
    |
    +---> Session persistence (needs local storage)

Export foundation (streaming CSV)
    |
    +---> Column selection (UI addition)
    |
    +---> Multiple formats (add format handlers)
    |
    +---> Background export (architectural change)
```

## MVP Recommendation

For v3 MVP, prioritize table stakes that address current bottlenecks ("full-fetch pattern crashes at scale"):

### Must Have (Phase 1-2)

1. **Cursor-based pagination API** - Foundation for everything else. Server-side, replaces full-fetch.
2. **Server-side filtering and sorting** - Can't do client-side at scale.
3. **TanStack Query integration** - Basic caching, SWR, retry. Low effort, high impact.
4. **Virtual scrolling** - Prevent DOM crashes. TanStack Virtual.
5. **Loading states** - User feedback during pagination/filtering.
6. **Sync status indicator** - "Last synced X minutes ago" + syncing indicator.
7. **Cache invalidation on mutation** - Lists update after create/edit/delete.

### Should Have (Phase 3)

8. **Optimistic updates** - Instant feedback for mutations.
9. **Streaming CSV export** - Export doesn't crash for large datasets.
10. **Saved views** - VA productivity for repetitive workflows.
11. **Quick filters** - One-click common filters.

### Defer to Post-MVP

- **IndexedDB persistence** - High complexity. Session cache sufficient for now.
- **Incremental sync** - High complexity. Full refresh with pagination is acceptable initially.
- **Infinite scroll hybrid** - Nice UX but standard pagination works.
- **Background export** - Streaming export handles most cases.
- **Conflict resolution UI** - Last-write-wins is acceptable for internal tool.
- **Offline queue** - Users are online. Brief network failures handled by retry.

## Complexity Estimates Summary

| Category | Low | Medium | High |
|----------|-----|--------|------|
| Large Dataset Browsing | 3 | 5 | 2 |
| Client-Side Caching | 3 | 1 | 3 |
| Sync UX | 4 | 2 | 2 |
| Export/Import | 2 | 3 | 3 |

**MVP effort (table stakes only):** Approximately 3-4 weeks of focused development.

**Differentiators effort:** Additional 2-4 weeks depending on selection.

## Sources

### High Confidence (Official Documentation / Context7)
- [TanStack Query - Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [TanStack Table - Pagination Guide](https://tanstack.com/table/v8/docs/guide/pagination)
- [Next.js - Caching and Revalidating](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)

### Medium Confidence (Verified Technical Sources)
- [Sentry - Paginating Large Datasets: Why OFFSET Fails and Cursors Win](https://blog.sentry.io/paginating-large-datasets-in-production-why-offset-fails-and-cursors-win/)
- [LogRocket - Offline-First Frontend Apps in 2025: IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [LogRocket - Pagination vs Infinite Scroll UX](https://blog.logrocket.com/ux-design/pagination-vs-infinite-scroll-ux/)
- [Pencil & Paper - UX Design Patterns for Loading](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback)
- [Pencil & Paper - Data Table Pattern UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Pencil & Paper - Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [Google Open Health Stack - Design Guidelines for Offline & Sync](https://developers.google.com/open-health-stack/design/offline-sync-guideline)
- [Carbon Design System - Status Indicators](https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Dromo - Best Practices for Handling Large CSV Files](https://dromo.io/blog/best-practices-handling-large-csv-files)

### Low Confidence (WebSearch Only - Verify Before Implementation)
- AI-powered smart filters for 2025 (unverified trend claim)
- 40-60% faster perceived load times with offline-first (survey data, not verified)
- 30-50% server load reduction with smart caching (McKinsey claim, not independently verified)

---

*Research complete: 2026-01-23*
*Confidence: MEDIUM-HIGH (core patterns well-documented, complexity estimates based on domain experience)*
