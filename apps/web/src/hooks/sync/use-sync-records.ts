'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useCallback, useState } from 'react';
import { db, type BookkeepingRecord } from '@/lib/db';
import { syncRecords } from '@/lib/db/sync';
import type { BookkeepingStatus } from '@/lib/api';

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

  // Live query - reactive to IndexedDB changes
  const records = useLiveQuery(async () => {
    const results = await db.records
      .where('account_id')
      .equals(accountId)
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
  }, [accountId, filters?.status, filters?.dateFrom, filters?.dateTo]);

  // Sync function that can be called manually or on mount
  const doSync = useCallback(async () => {
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
      setIsSyncing(false);
    }
  }, [accountId]);

  // Background sync on mount
  useEffect(() => {
    doSync();
  }, [doSync]);

  return {
    records: records ?? [],
    isLoading: records === undefined,
    isSyncing,
    error,
    refetch: doSync,
  };
}
