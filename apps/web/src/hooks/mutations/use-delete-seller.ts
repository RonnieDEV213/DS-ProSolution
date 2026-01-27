'use client';
import { useMutation } from '@tanstack/react-query';
import { db, type SellerRecord } from '@/lib/db';
import { sellerApi } from '@/lib/api';
import { useOnlineStatus } from '@/hooks/sync/use-online-status';
import { queueMutation } from '@/lib/db/pending-mutations';

interface DeleteSellerVars {
  ids: string[];
}

interface DeleteSellerContext {
  deletedRecords: SellerRecord[];
}

/**
 * Mutation hook for deleting one or more sellers.
 * Optimistically removes from IndexedDB (useLiveQuery reacts automatically).
 * Uses bulk delete API when multiple IDs are provided.
 * Queues mutations for offline replay when not connected.
 */
export function useDeleteSeller() {
  const isOnline = useOnlineStatus();

  return useMutation<void, Error, DeleteSellerVars, DeleteSellerContext>({
    mutationFn: async ({ ids }) => {
      if (!isOnline) {
        for (const id of ids) {
          await queueMutation({
            record_id: id,
            table: 'sellers',
            operation: 'delete',
            data: {},
          });
        }
        return;
      }

      // Online: use bulk delete for multiple, single for one
      if (ids.length === 1) {
        await sellerApi.deleteSeller(ids[0]);
      } else {
        await sellerApi.bulkDeleteSellers(ids);
      }
    },
    onMutate: async ({ ids }) => {
      // Snapshot for rollback
      const deletedRecords: SellerRecord[] = [];
      for (const id of ids) {
        const record = await db.sellers.get(id);
        if (record) deletedRecords.push(record);
      }
      // Optimistically remove from IndexedDB
      await db.sellers.bulkDelete(ids);
      return { deletedRecords };
    },
    onError: async (_error, _vars, context) => {
      // Rollback: restore deleted records
      if (context?.deletedRecords?.length) {
        await db.sellers.bulkPut(context.deletedRecords);
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
