import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type BookkeepingRecord } from "@/lib/api";

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
 * Mutation hook for deleting a record.
 * Uses optimistic updates for instant UI feedback.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useDeleteRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.records.infinite(orgId, accountId);

  return useMutation<void, Error, string, { previousData: InfiniteRecordsData | undefined }>({
    mutationFn: (recordId: string) => api.deleteRecord(recordId),
    onMutate: async (recordId: string) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous data
      const previousData = queryClient.getQueryData<InfiniteRecordsData>(queryKey);

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

      // Return context with previous data for rollback
      return { previousData };
    },
    onError: (_error, _recordId, context) => {
      // Rollback to previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate to ensure consistency with server
      queryClient.invalidateQueries({
        queryKey,
        exact: false,
      });
    },
  });
}
