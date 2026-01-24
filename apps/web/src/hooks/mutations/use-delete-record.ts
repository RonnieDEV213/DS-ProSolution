import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type BookkeepingRecord } from "@/lib/api";
import { db } from "@/lib/db";
import type { BookkeepingRecord as IndexedDBRecord } from "@/lib/db/schema";

/**
 * Response shape for infinite query pages.
 */
interface RecordsPage {
  items: BookkeepingRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Infinite query data structure
 */
interface InfiniteRecordsData {
  pages: RecordsPage[];
  pageParams: (string | null)[];
}

/**
 * Mutation context for rollback
 */
interface DeleteRecordContext {
  previousData: InfiniteRecordsData | undefined;
  deletedRecord: IndexedDBRecord | undefined;
}

/**
 * Mutation hook for deleting a record.
 * Uses optimistic updates for instant UI feedback and retry with exponential backoff.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useDeleteRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.records.infinite(orgId, accountId);

  return useMutation<void, Error, string, DeleteRecordContext>({
    mutationFn: (recordId: string) => api.deleteRecord(recordId),

    onMutate: async (recordId: string) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous data
      const previousData = queryClient.getQueryData<InfiniteRecordsData>(queryKey);

      // Get record before delete for potential rollback
      const deletedRecord = await db.records.get(recordId);

      // Optimistically remove record from cache
      if (previousData) {
        queryClient.setQueryData<InfiniteRecordsData>(queryKey, {
          ...previousData,
          pages: previousData.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== recordId),
          })),
        });
      }

      // Also delete from IndexedDB
      await db.records.delete(recordId);

      // Return context with previous data for rollback
      return { previousData, deletedRecord };
    },

    onError: async (_error, _recordId, context) => {
      // Rollback cache to previous data
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      // Restore deleted record to IndexedDB
      if (context?.deletedRecord) {
        await db.records.put(context.deletedRecord);
      }
    },

    onSettled: () => {
      // Invalidate to ensure consistency with server
      queryClient.invalidateQueries({
        queryKey,
        exact: false,
      });
    },

    // Retry logic: up to 3 times with exponential backoff
    retry: (failureCount, error) => {
      // Only retry on network/server errors (5xx), not validation errors (4xx)
      if (error instanceof Error) {
        const statusMatch = error.message.match(/\b(4\d{2}|5\d{2})\b/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1], 10);
          if (status >= 400 && status < 500) return false; // Don't retry 4xx
        }
      }
      return failureCount < 3; // Max 3 retries per CONTEXT.md
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
