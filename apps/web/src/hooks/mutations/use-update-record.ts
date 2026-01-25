import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type RecordUpdate, type BookkeepingRecord } from "@/lib/api";
import { db } from "@/lib/db";
import { useOnlineStatus } from "@/hooks/sync/use-online-status";
import { queueMutation } from "@/lib/db/pending-mutations";

interface UpdateRecordVariables {
  id: string;
  data: RecordUpdate;
}

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
interface UpdateRecordContext {
  previousData: InfiniteRecordsData | undefined;
}

/**
 * Mutation hook for updating a record.
 * Uses optimistic updates for instant UI feedback and retry with exponential backoff.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useUpdateRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.records.infinite(orgId, accountId);
  const isOnline = useOnlineStatus();

  return useMutation<BookkeepingRecord, Error, UpdateRecordVariables, UpdateRecordContext>({
    mutationFn: async ({ id, data }: UpdateRecordVariables) => {
      if (!isOnline) {
        // Queue mutation for later sync
        await queueMutation({
          record_id: id,
          table: 'records',
          operation: 'update',
          data: data as Record<string, unknown>,
        });
        // Return optimistic data shape - onMutate already updated cache/IndexedDB
        return { id, ...data } as BookkeepingRecord;
      }
      // Online: call API directly
      return api.updateRecord(id, data);
    },

    onMutate: async ({ id, data }) => {
      // Cancel in-flight queries to prevent overwrite
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous cache state for rollback
      const previousData = queryClient.getQueryData<InfiniteRecordsData>(queryKey);

      // Optimistically update cache
      if (previousData) {
        queryClient.setQueryData<InfiniteRecordsData>(queryKey, {
          ...previousData,
          pages: previousData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === id ? { ...item, ...data } : item
            ),
          })),
        });
      }

      // Also update IndexedDB for persistence
      await db.records.update(id, data);

      return { previousData };
    },

    onError: (_error, _variables, context) => {
      // Rollback cache to previous state
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      // Note: IndexedDB rollback is complex - server sync will correct
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
