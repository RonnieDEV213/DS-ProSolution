'use client';

import { useMutationState } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useOnlineStatus } from './use-online-status';

/**
 * Sync state values.
 */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

/**
 * Global sync state interface.
 */
export interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Number of pending operations (mutations + incomplete syncs) */
  pendingCount: number;
  /** Timestamp of last successful sync */
  lastSyncAt: Date | null;
  /** Error message if sync failed */
  error: string | null;
  /** Retry function to manually trigger sync */
  retry: () => void;
}

/**
 * Hook to aggregate global sync status from multiple sources.
 *
 * Combines:
 * - Network online/offline status via useOnlineStatus
 * - TanStack Query pending mutations via useMutationState
 * - IndexedDB sync metadata via useLiveQuery
 *
 * Status priority: offline > syncing > error > idle
 *
 * @returns SyncState with status, pendingCount, lastSyncAt, error, and retry
 *
 * @example
 * const { status, pendingCount, lastSyncAt, error, retry } = useSyncStatus();
 * if (status === 'error') {
 *   return <button onClick={retry}>Retry</button>;
 * }
 */
export function useSyncStatus(): SyncState {
  const isOnline = useOnlineStatus();
  const [lastError, setLastError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Track pending mutations from TanStack Query
  const pendingMutations = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.variables,
  });

  // Count incomplete syncs (where cursor is not null = partial sync in progress)
  const incompleteSyncs = useLiveQuery(async () => {
    const metas = await db._sync_meta.toArray();
    return metas.filter((meta) => meta.cursor !== null).length;
  }, [retryTrigger]);

  // Get most recent sync time across all tables
  const lastSyncTime = useLiveQuery(async () => {
    const metas = await db._sync_meta.toArray();
    if (metas.length === 0) return null;

    // Find the most recent last_sync_at
    let mostRecent: string | null = null;
    for (const meta of metas) {
      if (meta.last_sync_at) {
        if (!mostRecent || meta.last_sync_at > mostRecent) {
          mostRecent = meta.last_sync_at;
        }
      }
    }
    return mostRecent;
  }, [retryTrigger]);

  // Calculate total pending count
  const pendingCount = (pendingMutations?.length ?? 0) + (incompleteSyncs ?? 0);

  // Determine sync status with priority: offline > syncing > error > idle
  let status: SyncStatus = 'idle';
  if (!isOnline) {
    status = 'offline';
  } else if (pendingCount > 0) {
    status = 'syncing';
  } else if (lastError) {
    status = 'error';
  }

  // Clear error when we go back to syncing or idle
  useEffect(() => {
    if (status === 'syncing' || (status === 'idle' && pendingCount === 0 && isOnline)) {
      setLastError(null);
    }
  }, [status, pendingCount, isOnline]);

  // Retry function - triggers re-query of sync metadata and clears error
  const retry = useCallback(() => {
    setLastError(null);
    setRetryTrigger((prev) => prev + 1);
  }, []);

  return {
    status,
    pendingCount,
    lastSyncAt: lastSyncTime ? new Date(lastSyncTime) : null,
    error: lastError,
    retry,
  };
}
