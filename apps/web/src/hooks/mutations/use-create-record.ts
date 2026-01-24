import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type RecordCreate, type BookkeepingRecord } from "@/lib/api";

/**
 * Mutation hook for creating a new record.
 * Automatically invalidates records cache on success.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useCreateRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();

  return useMutation<BookkeepingRecord, Error, RecordCreate>({
    mutationFn: (data: RecordCreate) => api.createRecord(data),
    onSuccess: () => {
      // Invalidate all infinite queries for this account
      // exact: false matches any filter variations
      queryClient.invalidateQueries({
        queryKey: queryKeys.records.infinite(orgId, accountId),
        exact: false,
      });
    },
  });
}
