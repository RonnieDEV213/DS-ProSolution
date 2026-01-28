---
phase: 29-app-wide-persistent-cache
plan: 01
subsystem: data
tags: [indexeddb, dexie, tanstack-query, cache, persistence]

# Dependency graph
requires:
  - phase: 18
    provides: Dexie.js IndexedDB infrastructure (db singleton, schema, sync functions)
provides:
  - useCachedQuery hook for TanStack Query + IndexedDB persistence
  - _query_cache table in Dexie schema (version 4)
  - QueryCacheEntry type (key, data, cached_at)
  - Admin query keys in type-safe queryKeys factory
affects: [29-02, 29-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCachedQuery: IndexedDB read → initialData → TanStack Query → IndexedDB write"
    - "enabled: cacheChecked guard prevents query before IndexedDB check completes"
    - "initialDataUpdatedAt preserves TanStack Query staleness awareness"
    - "Graceful IndexedDB fallback with .catch() → fall through to network"

key-files:
  created:
    - apps/web/src/hooks/use-cached-query.ts
  modified:
    - apps/web/src/lib/db/index.ts
    - apps/web/src/lib/db/schema.ts
    - apps/web/src/lib/query-keys.ts

key-decisions:
  - "Separate cacheKey string from TanStack Query array key for stable IndexedDB lookup"
  - "initialData pattern (not placeholder) so components render cached data as real data"
  - "Schema version 4 with _query_cache table — minimal primary-key-only index"
  - "Admin query keys support pagination and org-scoping for cache key derivation"

patterns-established:
  - "useCachedQuery as drop-in useQuery replacement with persistent cache"
  - "Cache key convention: domain:entity:...params (e.g., admin:users:search:page)"

# Metrics
duration: retroactive
completed: 2026-01-27
---

# Phase 29 Plan 01: useCachedQuery Hook + DB Schema Summary

**TanStack Query + IndexedDB persistent cache foundation: useCachedQuery hook, _query_cache DB table, admin query keys**

## Performance

- **Duration:** Retroactive documentation (implemented ad-hoc)
- **Completed:** 2026-01-27
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 3

## Accomplishments
- Created useCachedQuery() hook with 3-phase cache lifecycle: IndexedDB read → initialData → background refresh → IndexedDB write
- Extended Dexie schema to version 4 with _query_cache table for persistent TanStack Query storage
- Added QueryCacheEntry type with key, data, cached_at fields
- Added admin query keys to type-safe queryKeys factory (users, departmentRoles, invites, dashboardCounts)
- Implemented graceful IndexedDB fallback — errors caught, falls through to normal network fetch

## Files Created/Modified
- `apps/web/src/hooks/use-cached-query.ts` — useCachedQuery hook (new)
- `apps/web/src/lib/db/index.ts` — Schema v4 with _query_cache table
- `apps/web/src/lib/db/schema.ts` — QueryCacheEntry type
- `apps/web/src/lib/query-keys.ts` — Admin query key factory

## Decisions Made

**1. Separate cacheKey from TanStack Query key**
- **Rationale:** IndexedDB needs a stable string key; TanStack Query uses array keys. Separate allows independent evolution.
- **Impact:** Each useCachedQuery call specifies its own cache key string.

**2. initialData over placeholder pattern**
- **Rationale:** Components treat cached data as real initial data, not a loading placeholder. TanStack Query handles staleness via initialDataUpdatedAt.
- **Impact:** No special "cached data" state in components — just works with existing data rendering logic.

**3. enabled: cacheChecked guard**
- **Rationale:** Without this, TanStack Query would fire immediately, showing a skeleton flash before the IndexedDB read completes and provides cached data.
- **Impact:** Small delay (IndexedDB read is ~1-5ms) but eliminates skeleton flash on cached visits.

## Deviations from Plan

None — retroactive documentation of ad-hoc implementation.

## Issues Encountered

None.

## Next Phase Readiness

**Ready for Plans 02 and 03:**
- useCachedQuery hook is ready for consumption by admin page components
- Admin query keys provide the cache key structure for each page
- _query_cache table exists in the database schema

**Blockers/Concerns:**
- None

---
*Phase: 29-app-wide-persistent-cache*
*Completed: 2026-01-27*
