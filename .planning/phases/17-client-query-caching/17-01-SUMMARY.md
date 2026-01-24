---
phase: 17-client-query-caching
plan: 01
subsystem: ui
tags: [tanstack-query, react-query, caching, hooks]

# Dependency graph
requires:
  - phase: 16-transport-layer
    provides: Cursor-paginated sync endpoints for future integration
provides:
  - TanStack Query v5 installed and configured
  - Type-safe query key factory for accounts and records
  - QueryProvider wrapping application with devtools
  - useAccounts query hook with 5-min stale time
  - useRecordsInfinite placeholder hook for Phase 18
affects: [17-02-mutation-hooks, 18-indexeddb-sync]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-query@5.90.20", "@tanstack/react-query-devtools@5.91.2"]
  patterns: [query-key-factory, ssr-safe-query-client, stale-while-revalidate]

key-files:
  created:
    - apps/web/src/lib/query-client.ts
    - apps/web/src/lib/query-keys.ts
    - apps/web/src/components/providers/query-provider.tsx
    - apps/web/src/hooks/queries/use-accounts.ts
    - apps/web/src/hooks/queries/use-records-infinite.ts
  modified:
    - apps/web/package.json
    - apps/web/src/app/layout.tsx

key-decisions:
  - "30s default staleTime for frequently changing data"
  - "5min staleTime for accounts (rarely change)"
  - "Exponential backoff retry (1s, 2s, 4s, max 30s)"
  - "useState pattern for SSR-safe QueryClient creation"

patterns-established:
  - "Query key factory: queryKeys.entity.scope(orgId, ...params)"
  - "Query hooks in hooks/queries/ directory"
  - "QueryProvider wraps children inside TooltipProvider"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 17 Plan 01: TanStack Query Infrastructure Summary

**TanStack Query v5 with stale-while-revalidate caching, query key factory, and placeholder infinite scroll hooks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T00:00:00Z
- **Completed:** 2026-01-24T00:03:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- TanStack Query v5.90.20 installed with devtools
- Query key factory provides type-safe keys scoped by orgId
- QueryProvider wraps application with SSR-safe client creation
- useAccounts hook ready for production use
- useRecordsInfinite placeholder ready for Phase 18 sync endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Install TanStack Query and create query infrastructure** - `17aa5e6` (feat)
2. **Task 2: Create query hooks and integrate QueryProvider** - `3475049` (feat)

## Files Created/Modified
- `apps/web/package.json` - Added TanStack Query dependencies
- `apps/web/src/lib/query-client.ts` - QueryClient factory with stale times and retry
- `apps/web/src/lib/query-keys.ts` - Type-safe query key factory
- `apps/web/src/components/providers/query-provider.tsx` - Client component QueryProvider
- `apps/web/src/hooks/queries/use-accounts.ts` - useAccounts hook (5-min stale)
- `apps/web/src/hooks/queries/use-records-infinite.ts` - Infinite query placeholder
- `apps/web/src/app/layout.tsx` - Wrapped children with QueryProvider

## Decisions Made
- 30s default staleTime for frequently changing data (records)
- 5min staleTime for accounts (rarely change)
- Exponential backoff retry: 1s, 2s, 4s capped at 30s, 3 retries
- useState pattern for SSR-safe QueryClient (not singleton)
- useRecordsInfinite is placeholder - wraps existing api.getRecords for now

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Query infrastructure ready for 17-02 mutation hooks
- useRecordsInfinite ready to swap in sync endpoint in Phase 18
- React Query Devtools accessible for debugging

---
*Phase: 17-client-query-caching*
*Completed: 2026-01-24*
