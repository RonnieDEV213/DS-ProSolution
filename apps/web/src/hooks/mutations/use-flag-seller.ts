'use client';
import { useMutation } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { sellerApi } from '@/lib/api';
import { useOnlineStatus } from '@/hooks/sync/use-online-status';
import { queueMutation } from '@/lib/db/pending-mutations';

interface FlagSellerVars {
  id: string;
  flagged: boolean;
}

/**
 * Mutation hook for toggling a seller's flagged status.
 * Routes through the batch flag endpoint (single-item array) so that
 * the server records an audit log entry for every flag operation.
 * Optimistically updates IndexedDB (useLiveQuery reacts automatically).
 * Queues mutation for offline replay when not connected.
 */
export function useFlagSeller() {
  const isOnline = useOnlineStatus();

  return useMutation<void, Error, FlagSellerVars>({
    mutationFn: async ({ id, flagged }) => {
      // Optimistically update IndexedDB immediately
      await db.sellers.update(id, { flagged });

      if (!isOnline) {
        await queueMutation({
          record_id: id,
          table: 'sellers',
          operation: 'update',
          data: { flagged },
        });
        return;
      }

      // Online: call batch flag endpoint (includes audit logging server-side)
      await sellerApi.flagBatch([id], flagged);
    },
    onError: async (_error, { id, flagged }) => {
      // Rollback IndexedDB on failure
      await db.sellers.update(id, { flagged: !flagged });
    },
    retry: (failureCount, error) => {
      if (error instanceof Error) {
        const statusMatch = error.message.match(/\b(4\d{2})\b/);
        if (statusMatch) return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Mutation hook for batch flag/unflag operations (e.g. drag painting).
 * Creates a single audit log entry for all affected sellers.
 * Optimistically updates IndexedDB for instant UI feedback.
 */
export function useBatchFlagSellers() {
  return useMutation<{ updated_count: number }, Error, { ids: string[]; flagged: boolean }>({
    mutationFn: async ({ ids, flagged }) => {
      // Optimistic: update all in IndexedDB
      await Promise.all(ids.map(id => db.sellers.update(id, { flagged })));
      // Call batch API (includes audit logging)
      return sellerApi.flagBatch(ids, flagged);
    },
    onError: async (_error, { ids, flagged }) => {
      // Rollback all
      await Promise.all(ids.map(id => db.sellers.update(id, { flagged: !flagged })));
    },
  });
}
