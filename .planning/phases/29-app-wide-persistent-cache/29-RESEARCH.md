# Phase 29: App-Wide Persistent Cache (V3 Lite) - Research

**Researched:** 2026-01-27 (retroactive — phase implemented ad-hoc)
**Domain:** IndexedDB persistence, TanStack Query caching, Dexie.js, stale-while-revalidate
**Confidence:** HIGH

## Summary

Phase 29 introduces a persistent cache layer that makes every page in the app load instantly on revisit. The core insight: the V3 sync pages (bookkeeping, sellers) load instantly from IndexedDB while legacy admin pages wait for network responses. The fix isn't full V3 sync for admin data — it's a lightweight persistent cache that wraps TanStack Query with IndexedDB storage.

The approach uses a single `useCachedQuery()` hook that reads from a `_query_cache` table in IndexedDB on mount, passes cached data as `initialData` to TanStack Query (preserving all existing stale-while-revalidate behavior), and writes fresh data back to IndexedDB when network responses arrive. This requires zero backend changes — existing REST API endpoints are reused as-is.

For the Accounts page specifically, the existing V3 infrastructure (`db.accounts` + `syncAccounts()`) was already 90% wired but the UI was bypassing it. A dedicated `useSyncAccounts()` hook completes that wiring using `useLiveQuery` for reactive IndexedDB reads.

**Primary recommendation:** Single `useCachedQuery()` hook wrapping TanStack Query with IndexedDB persistence via Dexie.js `_query_cache` table. Separate `useSyncAccounts()` hook for accounts (full V3 sync, not just cache).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^4.x | IndexedDB wrapper | Already installed (Phase 18), typed API, reactive queries |
| dexie-react-hooks | ^1.x | useLiveQuery | Already installed, reactive IndexedDB → React binding |
| @tanstack/react-query | ^5.x | Server state management | Already in use, provides stale-while-revalidate, background refresh |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IndexedDB _query_cache | TanStack Query persistQueryClient | Less control over cache key granularity, harder to debug, adds plugin dependency |
| Custom useCachedQuery | localStorage persistence | 5MB limit, synchronous blocking on read, no structured queries |
| Full V3 sync for admin | V3 Lite (cache-only) | Admin pages are low-churn, read-mostly — full sync is over-engineered |

## Architecture Patterns

### useCachedQuery Flow

```
Mount → Read _query_cache[key] → Found?
  ├── Yes → Pass as initialData + initialDataUpdatedAt → TanStack Query checks staleness
  └── No  → TanStack Query fetches normally (skeleton shown)

Network response → Write to _query_cache[key] → Available for next visit
```

### Cache Key Strategy

Cache keys are stable string identifiers scoped to the data they represent:
- `admin:users:{search}:{page}` — pagination-aware
- `admin:department-roles:{orgId}` — org-scoped
- `admin:invites:{page}` — pagination-aware
- `admin:dashboard-counts` — singleton aggregate

### Schema Extension

Database schema version 4 adds `_query_cache` table:
```typescript
_query_cache: 'key'  // Primary key only, no indexes needed
```

Entry shape: `{ key: string, data: any, cached_at: string }`

## Key Decisions

1. **Cache key is a separate string from TanStack Query key** — allows stable IndexedDB lookup independent of TanStack Query's array-based keys
2. **initialData pattern over placeholder** — TanStack Query treats cached data as real initial data, not placeholder, so components render it immediately
3. **initialDataUpdatedAt preserves staleness** — TanStack Query knows the age of cached data and refetches if stale
4. **enabled: cacheChecked** — query doesn't fire until IndexedDB read completes, preventing a flash of loading state before cached data is available
5. **Accounts use full V3 sync, not useCachedQuery** — accounts already have `db.accounts` table and `syncAccounts()` function; useSyncAccounts() with useLiveQuery is more appropriate than the generic cache

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IndexedDB unavailable (private browsing) | Low | Low | Graceful fallback — catch errors, fall through to network |
| Stale cache shown for too long | Medium | Low | TanStack Query staleTime controls freshness; background refresh handles updates |
| Cache grows unbounded | Low | Low | _query_cache entries are small (JSON payloads); can add TTL cleanup later |
| Schema version bump breaks existing data | Low | Medium | Dexie handles version upgrades automatically |

---
*Research completed: 2026-01-27 (retroactive)*
