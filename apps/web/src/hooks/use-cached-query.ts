'use client';

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { db } from '@/lib/db';

/**
 * Options for useCachedQuery — extends TanStack Query options with a cache key.
 */
interface UseCachedQueryOptions<TData>
  extends Omit<UseQueryOptions<TData, Error, TData>, 'initialData'> {
  /** IndexedDB cache key (e.g., "admin:users:1"). Must be stable. */
  cacheKey: string;
}

/**
 * TanStack Query + IndexedDB persistent cache.
 *
 * Behaviour:
 *   1. On mount: read `_query_cache[cacheKey]` from IndexedDB.
 *   2. If found → pass as `initialData` with `initialDataUpdatedAt`
 *      so TanStack Query shows cached data instantly AND knows its age.
 *   3. TanStack Query fires `queryFn` as usual (background refresh if stale).
 *   4. When fresh data arrives → write it back to IndexedDB for next visit.
 *
 * Result: first load shows skeleton, subsequent loads show cached data instantly.
 */
export function useCachedQuery<TData>(
  options: UseCachedQueryOptions<TData>,
): UseQueryResult<TData, Error> {
  const { cacheKey, ...queryOptions } = options;

  // --- Phase 1: IndexedDB cache read ---
  const [cached, setCached] = useState<{
    data: TData;
    updatedAt: number;
  } | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    db._query_cache
      .get(cacheKey)
      .then((entry) => {
        if (mounted && entry) {
          setCached({
            data: entry.data as TData,
            updatedAt: new Date(entry.cached_at).getTime(),
          });
        }
      })
      .catch(() => {
        // IndexedDB unavailable — fall through to network
      })
      .finally(() => {
        if (mounted) setCacheChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, [cacheKey]);

  // --- Phase 2: TanStack Query with optional cached initial data ---
  const query = useQuery<TData, Error, TData>({
    ...queryOptions,
    // Don't fire the query until we've checked the cache, so the initialData
    // is ready before the first render with query.data.
    enabled: cacheChecked && (queryOptions.enabled !== false),
    // Provide cached data so the component renders instantly
    ...(cached
      ? {
          initialData: cached.data,
          initialDataUpdatedAt: cached.updatedAt,
        }
      : {}),
  });

  // --- Phase 3: Write fresh data back to IndexedDB ---
  useEffect(() => {
    // Only persist when we have real network data (not initial data echo)
    if (query.data !== undefined && query.dataUpdatedAt > 0) {
      db._query_cache
        .put({
          key: cacheKey,
          data: query.data,
          cached_at: new Date(query.dataUpdatedAt).toISOString(),
        })
        .catch(() => {
          // IndexedDB write failed — non-critical, just log
          console.warn('[useCachedQuery] Failed to persist cache for', cacheKey);
        });
    }
  }, [query.data, query.dataUpdatedAt, cacheKey]);

  return query;
}
