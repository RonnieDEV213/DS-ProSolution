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

      // Online: call API
      await sellerApi.flagSeller(id);
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
