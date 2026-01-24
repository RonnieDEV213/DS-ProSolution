# Phase 17: Client Query Caching - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

TanStack Query integration for list views with stale-while-revalidate caching and automatic mutation invalidation. Covers query setup, cache configuration, invalidation patterns, and loading states. IndexedDB persistence and sync engine are Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Stale-while-revalidate behavior
- Stale times vary by data type (Claude's discretion based on volatility)
- Refetch on window focus enabled
- Show stale data immediately while refetching (instant perceived performance)
- Background refetch happens transparently

### Invalidation strategy
- Invalidate item, list, AND related aggregates (counts, summaries) on mutation
- Invalidate ALL pages of paginated lists after mutation (item could move between pages)
- 3 retries with exponential backoff on network failure
- Delete mutation optimistic vs confirmed: Claude's discretion based on context

### Loading states
- Skeleton rows for cold start (first load with no cache)
- Subtle indicator (small spinner in corner/header) during background refetch
- Mutation loading: disabled button + spinner, toast for longer operations
- Error state: inline error replacing content with retry button

### Query key structure
- Array hierarchy pattern: `['sales', orgId, accountId, { filters, cursor }]`
- Include org_id in all keys (cache scoped per organization)
- Typed query key factory functions: `salesKeys.list(accountId, filters)`
- Use `useInfiniteQuery` for cursor pagination (pages accumulate)

### Claude's Discretion
- Exact stale time values per data type
- Delete mutation optimistic vs wait-for-confirmation
- Retry backoff timing
- Skeleton row count and appearance

</decisions>

<specifics>
## Specific Ideas

- Query key factory should be type-safe and centralized for consistency
- Subtle refetch indicator should not distract from content
- Error + retry pattern should be clear and actionable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-client-query-caching*
*Context gathered: 2026-01-24*
