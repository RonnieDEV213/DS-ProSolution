---
phase: 29-app-wide-persistent-cache
plan: 02
subsystem: ui
tags: [admin, cache, persistent-cache, skeleton, users, roles, invites, dashboard]

# Dependency graph
requires:
  - phase: 29-01
    provides: useCachedQuery hook, _query_cache table, admin query keys
provides:
  - /admin/users loads from persistent IndexedDB cache on revisit
  - /admin/department-roles loads from persistent IndexedDB cache on revisit
  - /admin/invites loads from persistent IndexedDB cache on revisit
  - /admin dashboard counts load from persistent IndexedDB cache on revisit
affects: [30-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCachedQuery with pagination-aware cache keys (admin:users:{search}:{page})"
    - "useCachedQuery with org-scoped cache keys (admin:department-roles:{orgId})"
    - "Stale time tiering: 30s for moderate churn, 60s for low churn datasets"

key-files:
  created: []
  modified:
    - apps/web/src/components/admin/users-table.tsx
    - apps/web/src/components/admin/department-roles-table.tsx
    - apps/web/src/components/admin/invites-list.tsx
    - apps/web/src/app/admin/page.tsx

key-decisions:
  - "30s stale time for users and invites (moderate churn — people join/leave)"
  - "60s stale time for department roles and dashboard counts (low churn — rarely change)"
  - "Cache key includes all query parameters for correct per-page/per-search caching"

patterns-established:
  - "Replace useQuery with useCachedQuery for instant revisit loading"
  - "Skeleton → cached data transition pattern for admin pages"

# Metrics
duration: retroactive
completed: 2026-01-27
---

# Phase 29 Plan 02: Wire Legacy Admin Pages to Persistent Cache Summary

**4 admin pages wired to useCachedQuery for instant load on revisit**

## Performance

- **Duration:** Retroactive documentation (implemented ad-hoc)
- **Completed:** 2026-01-27
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Wired /admin/users to useCachedQuery with pagination + search-aware cache key (`admin:users:{search}:{page}`)
- Wired /admin/department-roles to useCachedQuery with org-scoped cache key (`admin:department-roles:{orgId}`)
- Wired /admin/invites to useCachedQuery with pagination-aware cache key (`admin:invites:{page}`)
- Wired /admin dashboard counts to useCachedQuery with singleton cache key (`admin:dashboard-counts`)
- All pages show skeleton on first load, cached data instantly on revisit
- Appropriate stale times: 30s for users/invites, 60s for roles/dashboard

## Files Created/Modified
- `apps/web/src/components/admin/users-table.tsx` — useCachedQuery for users list
- `apps/web/src/components/admin/department-roles-table.tsx` — useCachedQuery for roles
- `apps/web/src/components/admin/invites-list.tsx` — useCachedQuery for invites
- `apps/web/src/app/admin/page.tsx` — useCachedQuery for dashboard counts

## Decisions Made

**1. Stale time tiering by data churn rate**
- **Rationale:** Users and invites change moderately (people joining/leaving). Roles and dashboard counts rarely change.
- **Impact:** 30s stale time for users/invites, 60s for roles/dashboard — balances freshness and network efficiency.

**2. Cache key includes all query parameters**
- **Rationale:** Paginated data must be cached per-page, searched data per-search-term. Prevents serving stale results from wrong page/search.
- **Impact:** Each unique combination of parameters gets its own IndexedDB entry.

## Deviations from Plan

None — retroactive documentation of ad-hoc implementation.

## Issues Encountered

None.

## Next Phase Readiness

**Ready for Phase 30 (Skeletons & Empty States):**
- All admin pages now have the cache-first pattern that Phase 30 skeletons must work with
- Skeleton loading states already in place (can be standardized in Phase 30)

**Blockers/Concerns:**
- None

---
*Phase: 29-app-wide-persistent-cache*
*Completed: 2026-01-27*
