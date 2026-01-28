'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db, type CollectionRunRecord } from '@/lib/db';
import { syncCollectionRuns } from '@/lib/db/sync';

interface UseSyncRunHistoryResult {
  runs: CollectionRunRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  totalCount: number;
  refetch: () => void;
}

/**
 * Cache-first hook for collection run history.
 * Returns data from IndexedDB immediately, syncs from server in background.
 * Uses useLiveQuery for reactive updates when IndexedDB changes.
 */
export function useSyncRunHistory(): UseSyncRunHistoryResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);

  // Live query - reactive, sorted by most recent first
  const runs = useLiveQuery(async () => {
    const allRuns = await db.collection_runs
      .orderBy('started_at')
      .reverse()
      .toArray();
    return allRuns;
  }, []);

  const totalCount = useLiveQuery(
    () => db.collection_runs.count(),
    []
  ) ?? 0;

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      await syncCollectionRuns();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Run history sync failed'));
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Sync on mount
  useEffect(() => {
    doSync();
  }, [doSync]);

  return {
    runs: runs ?? [],
    isLoading: runs === undefined,
    isSyncing,
    error,
    totalCount,
    refetch: doSync,
  };
}
