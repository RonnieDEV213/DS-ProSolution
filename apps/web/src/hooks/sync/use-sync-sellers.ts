'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useCallback, useState } from 'react';
import { db, type SellerRecord } from '@/lib/db';
import { syncSellers } from '@/lib/db/sync';

interface UseSyncSellersOptions {
  filters?: {
    flagged?: boolean;
    search?: string;
  };
}

interface UseSyncSellersResult {
  sellers: SellerRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  totalCount: number;
  flaggedCount: number;
  refetch: () => void;
}

/**
 * Cache-first hook for sellers.
 * Returns data from IndexedDB immediately, syncs from server in background.
 * Uses useLiveQuery for reactive updates when IndexedDB changes.
 *
 * Unlike useSyncRecords, sellers are org-wide (no accountId scoping) and
 * return all matching results (no pagination at hook level -- SellersGrid
 * uses react-window virtualization for rendering performance).
 */
export function useSyncSellers(options: UseSyncSellersOptions = {}): UseSyncSellersResult {
  const { filters } = options;
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);

  // Live query - reactive to IndexedDB changes
  // Returns ALL sellers matching filters (no pagination at hook level --
  // SellersGrid uses react-window virtualization for rendering performance)
  const sellers = useLiveQuery(async () => {
    let results: SellerRecord[];

    // Use index for flagged filter if no search (more efficient)
    if (filters?.flagged !== undefined && !filters?.search) {
      // Dexie stores booleans as 0/1 in indexes
      results = await db.sellers
        .where('flagged')
        .equals(filters.flagged ? 1 : 0)
        .toArray();
    } else {
      results = await db.sellers.toArray();
    }

    // Apply filters in memory
    if (filters?.flagged !== undefined && filters?.search) {
      results = results.filter(s => {
        // Dexie boolean comparison: s.flagged may be boolean or 0/1
        const isFlagged = s.flagged === true || (s.flagged as unknown) === 1;
        return filters.flagged ? isFlagged : !isFlagged;
      });
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      results = results.filter(s =>
        s.display_name.toLowerCase().includes(term)
      );
    }

    // Sort by display_name ASC for consistent grid order
    results.sort((a, b) => a.display_name.localeCompare(b.display_name));

    return results;
  }, [filters?.flagged, filters?.search]);

  const totalCount = useLiveQuery(() => db.sellers.count(), []) ?? 0;

  // Flagged count: use index for efficiency
  // Note: Dexie boolean index stores as 0/1, so use equals(1) for true
  const flaggedCount = useLiveQuery(async () => {
    try {
      return await db.sellers.where('flagged').equals(1).count();
    } catch {
      // Fallback if index doesn't work with 0/1: filter in memory
      const all = await db.sellers.toArray();
      return all.filter(s => s.flagged === true || (s.flagged as unknown) === 1).length;
    }
  }, []) ?? 0;

  // Sync function
  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      await syncSellers();
    } catch (err) {
      const syncError = err instanceof Error ? err : new Error('Seller sync failed');
      setError(syncError);
      console.error('[useSyncSellers] Sync failed:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Background sync on mount
  useEffect(() => {
    doSync();
  }, [doSync]);

  return {
    sellers: sellers ?? [],
    isLoading: sellers === undefined,
    isSyncing,
    error,
    totalCount,
    flaggedCount,
    refetch: doSync,
  };
}
