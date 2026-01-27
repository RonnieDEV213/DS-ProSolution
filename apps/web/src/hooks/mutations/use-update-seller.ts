'use client';
import { useMutation } from '@tanstack/react-query';
import { db, type SellerRecord } from '@/lib/db';
import { sellerApi } from '@/lib/api';
import { useOnlineStatus } from '@/hooks/sync/use-online-status';
import { queueMutation } from '@/lib/db/pending-mutations';

interface UpdateSellerVars {
  id: string;
  name: string;
}

interface UpdateSellerContext {
  previousRecord: SellerRecord | undefined;
}

/**
 * Mutation hook for updating a seller's display name.
 * Optimistically updates IndexedDB (useLiveQuery reacts automatically).
 * Queues mutation for offline replay when not connected.
 */
export function useUpdateSeller() {
  const isOnline = useOnlineStatus();

  return useMutation<void, Error, UpdateSellerVars, UpdateSellerContext>({
    mutationFn: async ({ id, name }) => {
      // Optimistically update IndexedDB
      await db.sellers.update(id, { display_name: name });

      if (!isOnline) {
        await queueMutation({
          record_id: id,
          table: 'sellers',
          operation: 'update',
          data: { name },
        });
        return;
      }

      await sellerApi.updateSeller(id, name);
    },
    onMutate: async ({ id }) => {
      const previousRecord = await db.sellers.get(id);
      return { previousRecord };
    },
    onError: async (_error, _vars, context) => {
      // Rollback IndexedDB
      if (context?.previousRecord) {
        await db.sellers.put(context.previousRecord);
      }
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
