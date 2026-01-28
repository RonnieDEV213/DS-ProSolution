'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useCallback, useState } from 'react';
import { db, type AccountRecord } from '@/lib/db';
import { syncAccounts } from '@/lib/db/sync';

interface UseSyncAccountsOptions {
  search?: string;
}

interface UseSyncAccountsResult {
  accounts: AccountRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  error: Error | null;
  totalCount: number;
  refetch: () => void;
}

/**
 * Cache-first hook for accounts.
 * Returns data from IndexedDB immediately, syncs from server in background.
 * Uses useLiveQuery for reactive updates when IndexedDB changes.
 *
 * Completes the "90% V3 wiring" — db.accounts + syncAccounts() already exist
 * but the UI previously bypassed them with direct API fetch.
 */
export function useSyncAccounts(options: UseSyncAccountsOptions = {}): UseSyncAccountsResult {
  const { search } = options;
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);

  // Live query — reactive to IndexedDB changes
  const accounts = useLiveQuery(async () => {
    let results = await db.accounts.toArray();

    // Apply search filter in memory
    if (search) {
      const term = search.toLowerCase();
      results = results.filter(
        (a) =>
          a.account_code.toLowerCase().includes(term) ||
          (a.name && a.name.toLowerCase().includes(term))
      );
    }

    // Sort by account_code ASC
    results.sort((a, b) => a.account_code.localeCompare(b.account_code));

    return results;
  }, [search]);

  const totalCount = useLiveQuery(() => db.accounts.count(), []) ?? 0;

  // Sync function
  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      await syncAccounts();
    } catch (err) {
      const syncError = err instanceof Error ? err : new Error('Account sync failed');
      setError(syncError);
      console.error('[useSyncAccounts] Sync failed:', err);
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
    accounts: accounts ?? [],
    isLoading: accounts === undefined,
    isSyncing,
    error,
    totalCount,
    refetch: doSync,
  };
}
