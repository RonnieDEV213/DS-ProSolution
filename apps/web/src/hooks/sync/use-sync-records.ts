'use client';

import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useCallback, useState } from 'react';
import { db, type BookkeepingRecord } from '@/lib/db';
import { syncRecords } from '@/lib/db/sync';
import type { BookkeepingStatus } from '@/lib/api';

const PAGE_SIZE = 50;

interface UseSyncRecordsOptions {
  accountId: string;
  filters?: {
    status?: BookkeepingStatus;
    dateFrom?: string;
    dateTo?: string;
  };
}

interface UseSyncRecordsResult {
  records: BookkeepingRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Cache-first hook for records.
 * Returns data from IndexedDB immediately, syncs from server in background.
 * Uses useLiveQuery for reactive updates when IndexedDB changes.
 */
export function useSyncRecords({ accountId, filters }: UseSyncRecordsOptions): UseSyncRecordsResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Track whether the first sync for the current account has completed.
  // Prevents false "no records" empty state when useLiveQuery returns []
  // before IndexedDB data is available on component remount.
  const hasSyncedOnceRef = useRef(false);

  // Live query - reactive to IndexedDB changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    hasSyncedOnceRef.current = false;
  }, [accountId]);

  const records = useLiveQuery(async () => {
    if (!accountId) return [];

    const results = await db.records
      .where('[account_id+sale_date]')
      .between([accountId, Dexie.minKey], [accountId, Dexie.maxKey])
      .reverse()
      .limit(visibleCount)
      .toArray();

    // Apply additional filters in memory (Dexie compound indexes have limitations)
    return results
      .filter((r) => {
        if (filters?.status && r.status !== filters.status) return false;
        if (filters?.dateFrom && r.sale_date < filters.dateFrom) return false;
        if (filters?.dateTo && r.sale_date > filters.dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by sale_date DESC, then id DESC (match server order)
        const dateCompare = b.sale_date.localeCompare(a.sale_date);
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      });
  }, [accountId, filters?.status, filters?.dateFrom, filters?.dateTo, visibleCount]);

  const totalCount =
    useLiveQuery(async () => {
      if (!accountId) return 0;
      return db.records.where('account_id').equals(accountId).count();
    }, [accountId]) ?? 0;

  const hasMore = visibleCount < totalCount;
  const loadMore = useCallback(() => {
    setVisibleCount((current) => current + PAGE_SIZE);
  }, []);

  // Sync function that can be called manually or on mount
  const doSync = useCallback(async () => {
    if (!accountId) {
      syncingRef.current = false;
      setIsSyncing(false);
      setError(null);
      return;
    }
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      await syncRecords(accountId);
    } catch (err) {
      const syncError = err instanceof Error ? err : new Error('Sync failed');
      setError(syncError);
      console.error('[useSyncRecords] Sync failed:', err);
    } finally {
      syncingRef.current = false;
      hasSyncedOnceRef.current = true;
      setIsSyncing(false);
    }
  }, [accountId]);

  // Background sync on mount
  useEffect(() => {
    if (!accountId) return;
    doSync();
  }, [accountId, doSync]);

  // Loading when:
  // 1. useLiveQuery hasn't returned yet (records === undefined), OR
  // 2. Records array is empty AND we haven't completed the first sync.
  //    This prevents a false "no records" empty state flash when the
  //    IndexedDB query returns [] momentarily before real data appears
  //    on component remount (e.g., navigating back to the page).
  const isLoading =
    records === undefined ||
    (records !== undefined && records.length === 0 && !hasSyncedOnceRef.current && !!accountId);

  return {
    records: records ?? [],
    isLoading,
    isSyncing,
    error,
    hasMore,
    totalCount,
    loadMore,
    refetch: doSync,
  };
}
