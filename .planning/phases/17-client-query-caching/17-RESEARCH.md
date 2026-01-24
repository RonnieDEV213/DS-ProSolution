# Phase 17: Client Query Caching - Research

**Researched:** 2026-01-24
**Domain:** TanStack Query (React Query) with Next.js App Router
**Confidence:** HIGH

## Summary

TanStack Query v5 is the standard library for client-side server state management in React applications. It provides stale-while-revalidate caching, automatic background refetching, and mutation-based cache invalidation out of the box.

The codebase currently uses manual `useEffect` + `fetch` patterns with local component state. Migrating to TanStack Query will eliminate duplicate request logic, provide automatic caching, and enable declarative cache invalidation after mutations.

Key implementation decisions from CONTEXT.md are well-supported by TanStack Query:
- `useInfiniteQuery` natively supports cursor-based pagination (Phase 16 endpoints)
- Query key factories provide type-safe, hierarchical cache invalidation
- Built-in `staleTime` and `refetchOnWindowFocus` configuration

**Primary recommendation:** Install `@tanstack/react-query` v5.90+, create a QueryProvider with sensible defaults, implement query key factories per entity type, and wrap all data-fetching components with TanStack Query hooks.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | 5.90+ | Server state management | Industry standard, 38k+ GitHub stars, maintained by TanStack |
| @tanstack/react-query-devtools | 5.90+ | Query inspection/debugging | Essential for development, shows cache state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lukemorales/query-key-factory | 1.3+ | Type-safe query keys | Optional but recommended for larger apps with many queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | SWR | SWR is lighter but lacks mutation coordination, devtools, and infinite query features |
| TanStack Query | RTK Query | RTK Query is heavier, requires Redux, overkill for this app |
| query-key-factory | Manual keys | Manual keys work fine for small apps; factory adds type safety at scale |

**Installation:**
```bash
cd apps/web && npm install @tanstack/react-query @tanstack/react-query-devtools
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── api.ts               # Existing fetch functions (kept as-is)
│   ├── query-client.ts      # QueryClient configuration
│   └── query-keys.ts        # Query key factory definitions
├── hooks/
│   ├── queries/             # Query hooks by entity
│   │   ├── use-accounts.ts
│   │   ├── use-records.ts
│   │   └── use-sellers.ts
│   └── mutations/           # Mutation hooks by entity
│       ├── use-create-record.ts
│       ├── use-update-record.ts
│       └── use-delete-record.ts
├── components/
│   └── providers/
│       └── query-provider.tsx  # QueryClientProvider wrapper
```

### Pattern 1: Query Provider Setup

**What:** Wrap app with QueryClientProvider as a client component
**When to use:** Once, in root layout or app-level provider

```typescript
// src/components/providers/query-provider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState ensures QueryClient is created once per component lifecycle
  // This prevents issues with SSR/hydration
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Data considered fresh for 30 seconds
          staleTime: 30 * 1000,
          // Keep unused data in cache for 5 minutes
          gcTime: 5 * 60 * 1000,
          // Retry 3 times with exponential backoff
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          // Refetch when window regains focus
          refetchOnWindowFocus: true,
          // Don't refetch on mount if data is fresh
          refetchOnMount: true,
        },
        mutations: {
          // Retry mutations on network failure
          retry: 3,
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Pattern 2: Query Key Factory

**What:** Centralized, type-safe query key definitions
**When to use:** For all query keys to ensure consistent invalidation

```typescript
// src/lib/query-keys.ts

// Query key factory pattern - hierarchical keys for precise invalidation
export const queryKeys = {
  // Accounts
  accounts: {
    all: (orgId: string) => ['accounts', orgId] as const,
    list: (orgId: string, filters?: { search?: string }) =>
      ['accounts', orgId, 'list', filters] as const,
    detail: (orgId: string, accountId: string) =>
      ['accounts', orgId, 'detail', accountId] as const,
  },

  // Records (bookkeeping)
  records: {
    all: (orgId: string) => ['records', orgId] as const,
    list: (orgId: string, accountId: string, filters?: RecordFilters) =>
      ['records', orgId, accountId, 'list', filters] as const,
    detail: (orgId: string, recordId: string) =>
      ['records', orgId, 'detail', recordId] as const,
    // Infinite query for cursor pagination
    infinite: (orgId: string, accountId: string, filters?: RecordFilters) =>
      ['records', orgId, accountId, 'infinite', filters] as const,
  },

  // Sellers
  sellers: {
    all: (orgId: string) => ['sellers', orgId] as const,
    list: (orgId: string, filters?: SellerFilters) =>
      ['sellers', orgId, 'list', filters] as const,
    infinite: (orgId: string, filters?: SellerFilters) =>
      ['sellers', orgId, 'infinite', filters] as const,
  },
} as const;

// Type for filters
interface RecordFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface SellerFilters {
  flagged?: boolean;
}
```

### Pattern 3: useInfiniteQuery for Cursor Pagination

**What:** Paginated queries that accumulate pages for infinite scroll
**When to use:** List views with cursor-based pagination (Phase 16 sync endpoints)

```typescript
// src/hooks/queries/use-records-infinite.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface RecordSyncResponse {
  items: RecordSyncItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export function useRecordsInfinite(
  orgId: string,
  accountId: string,
  filters?: RecordFilters
) {
  return useInfiniteQuery({
    queryKey: queryKeys.records.infinite(orgId, accountId, filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('account_id', accountId);
      params.set('limit', '50');
      if (pageParam) params.set('cursor', pageParam);
      if (filters?.status) params.set('status', filters.status);

      const res = await fetchAPI<RecordSyncResponse>(`/sync/records?${params}`);
      return res;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    // Stale time for records - relatively volatile data
    staleTime: 30 * 1000,
  });
}
```

### Pattern 4: Mutation with Cache Invalidation

**What:** Mutations that automatically invalidate related queries
**When to use:** All create/update/delete operations

```typescript
// src/hooks/mutations/use-create-record.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api';

export function useCreateRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordCreate) => api.createRecord(data),
    onSuccess: () => {
      // Invalidate ALL record queries for this account
      // This includes list views and infinite queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.records.list(orgId, accountId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.records.infinite(orgId, accountId),
      });
    },
    onError: (error) => {
      // Error handling - toast will be shown by component
      console.error('Failed to create record:', error);
    },
  });
}
```

### Pattern 5: Optimistic Updates for Deletes

**What:** Immediately update UI, roll back on failure
**When to use:** Delete operations where instant feedback improves UX

```typescript
// src/hooks/mutations/use-delete-record.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api';

export function useDeleteRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => api.deleteRecord(recordId),
    onMutate: async (recordId) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.records.infinite(orgId, accountId),
      });

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData(
        queryKeys.records.infinite(orgId, accountId)
      );

      // Optimistically remove from cache
      queryClient.setQueryData(
        queryKeys.records.infinite(orgId, accountId),
        (old: any) => ({
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.filter((r: any) => r.id !== recordId),
          })),
        })
      );

      return { previousData };
    },
    onError: (err, recordId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.records.infinite(orgId, accountId),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.records.infinite(orgId, accountId),
      });
    },
  });
}
```

### Anti-Patterns to Avoid

- **Creating QueryClient in component body:** Always use `useState(() => new QueryClient())` to prevent SSR issues
- **Fetching in useEffect alongside TanStack Query:** Pick one approach; mixing causes race conditions
- **Manual cache updates for creates:** Invalidation is safer; new items may affect pagination
- **Invalidating by prefix too broadly:** Use specific query keys to avoid unnecessary refetches
- **Forgetting orgId in query keys:** All queries must be scoped per organization

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request deduplication | Custom debounce/throttle | TanStack Query built-in | Handles concurrent requests, race conditions |
| Background refetching | setInterval + fetch | staleTime + refetchOnWindowFocus | Memory management, lifecycle handling |
| Infinite scroll state | Manual page accumulation | useInfiniteQuery | Handles cursor tracking, page merging |
| Loading/error states | Manual isLoading state | Query status flags | isPending, isFetching, isError built-in |
| Retry logic | Custom retry wrapper | Query retry option | Exponential backoff, configurable attempts |
| Cache invalidation | Manual state resets | invalidateQueries | Precise targeting, automatic refetch |

**Key insight:** TanStack Query handles all the edge cases you'd forget - request cancellation on unmount, stale data detection, concurrent request deduplication, and memory management for cached data.

## Common Pitfalls

### Pitfall 1: Query Key Mismatches

**What goes wrong:** Queries don't invalidate because keys don't match exactly
**Why it happens:** Object reference inequality, key ordering issues
**How to avoid:** Use query key factory, always serialize filters the same way
**Warning signs:** Data doesn't refresh after mutation, devtools shows multiple similar queries

### Pitfall 2: Infinite Query Memory Bloat

**What goes wrong:** Memory grows unbounded as user scrolls
**Why it happens:** All pages accumulate in memory
**How to avoid:** Use `maxPages` option to limit stored pages (v5 feature)
**Warning signs:** Page becomes slow after extended scrolling, browser memory warnings

### Pitfall 3: Flash of Stale Data

**What goes wrong:** Old data briefly shows before new data loads
**Why it happens:** staleTime too short, immediate component mount triggers refetch
**How to avoid:** Set appropriate staleTime (30s-60s for most data), use placeholderData
**Warning signs:** Content flickers on navigation, users report seeing old data

### Pitfall 4: SSR Hydration Mismatch

**What goes wrong:** React hydration errors in console
**Why it happens:** Server and client render different query states
**How to avoid:** Mark provider as 'use client', don't prefetch without HydrationBoundary
**Warning signs:** Console errors about hydration, content flashing on page load

### Pitfall 5: Over-Invalidation

**What goes wrong:** Entire cache clears on single mutation
**Why it happens:** Using too-broad query key prefix in invalidation
**How to avoid:** Target specific query keys, not entire entity namespace
**Warning signs:** Unrelated lists refresh, multiple network requests after mutation

## Code Examples

### Loading State Pattern with Skeleton

```typescript
// Component using query with skeleton loading
function RecordsList({ orgId, accountId }: Props) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isFetching,
  } = useRecordsInfinite(orgId, accountId);

  // Initial load - show skeleton
  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  // Flatten pages into single array
  const records = data?.pages.flatMap(page => page.items) ?? [];

  return (
    <div>
      {/* Background refetch indicator - subtle */}
      {isFetching && !isPending && (
        <div className="absolute top-2 right-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        </div>
      )}

      {/* Records list */}
      <RecordsTable records={records} />

      {/* Load more trigger */}
      {hasNextPage && (
        <Button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </div>
  );
}
```

### Mutation with Toast Feedback

```typescript
function AddRecordButton({ orgId, accountId }: Props) {
  const createRecord = useCreateRecord(orgId, accountId);

  const handleSubmit = async (data: RecordCreate) => {
    try {
      await createRecord.mutateAsync(data);
      toast.success('Record created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create');
    }
  };

  return (
    <Button
      onClick={() => handleSubmit(formData)}
      disabled={createRecord.isPending}
    >
      {createRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Add Record
    </Button>
  );
}
```

### Stale Time by Data Volatility

```typescript
// src/lib/stale-times.ts

// How long data is considered "fresh" (no refetch even on mount/focus)
export const staleTimes = {
  // Accounts rarely change - 5 minutes
  accounts: 5 * 60 * 1000,

  // Records change more frequently - 30 seconds
  records: 30 * 1000,

  // Sellers update frequently during collection - 15 seconds
  sellers: 15 * 1000,

  // User profile - almost never changes - 10 minutes
  userProfile: 10 * 60 * 1000,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cacheTime | gcTime | TanStack Query v5 | Renamed for clarity (garbage collection time) |
| isLoading (any loading) | isPending (no data) + isFetching (any fetch) | v5 | More precise loading states |
| onSuccess/onError in useQuery | Removed from useQuery | v5 | Use component-level error boundaries, onSettled in mutations |
| keepPreviousData | placeholderData callback | v5 | More flexible placeholder patterns |
| Hydrate component | HydrationBoundary | v5 | Better SSR/hydration support |

**Deprecated/outdated:**
- React Query v3/v4 patterns - use v5 API
- `useHydrate` hook - removed in v5
- `cacheTime` option - renamed to `gcTime`
- Callbacks in `useQuery` - moved to component level

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal maxPages for infinite scroll**
   - What we know: v5 supports maxPages option to limit memory
   - What's unclear: Ideal limit depends on record size and user behavior
   - Recommendation: Start with maxPages: 10, monitor memory in production

2. **Prefetching strategy for accounts list**
   - What we know: Accounts are stable, could prefetch on login
   - What's unclear: Whether prefetch overhead is worth it for small lists
   - Recommendation: Implement basic queries first, add prefetch if needed

## Sources

### Primary (HIGH confidence)
- [TanStack Query v5 Documentation](https://tanstack.com/query/v5) - Core API reference
- [TanStack Query React Examples - Next.js](https://tanstack.com/query/latest/docs/framework/react/examples/nextjs) - Official Next.js integration example
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) - Version 5.90.19, React 18+ required

### Secondary (MEDIUM confidence)
- [Infinite Queries Guide](https://tanstack.com/query/v5/docs/react/guides/infinite-queries) - useInfiniteQuery patterns
- [Query Invalidation Guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) - Invalidation strategies
- [Migrating to v5 Guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) - Breaking changes from v4
- [lukemorales/query-key-factory](https://github.com/lukemorales/query-key-factory) - Query key factory pattern

### Tertiary (LOW confidence)
- [TkDodo's Practical React Query](https://tkdodo.eu/blog/practical-react-query) - Community best practices
- [Announcing TanStack Query v5](https://tanstack.com/blog/announcing-tanstack-query-v5) - v5 feature overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Query is undisputed leader, well-documented
- Architecture: HIGH - Patterns from official docs and community consensus
- Pitfalls: MEDIUM - Based on community discussions and common issues

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable library, slow-moving)
