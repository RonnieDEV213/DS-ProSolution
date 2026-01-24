import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type RecordUpdate, type BookkeepingRecord } from "@/lib/api";

interface UpdateRecordVariables {
  id: string;
  data: RecordUpdate;
}

/**
 * Mutation hook for updating a record.
 * Automatically invalidates records cache on success.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useUpdateRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();

  return useMutation<BookkeepingRecord, Error, UpdateRecordVariables>({
    mutationFn: ({ id, data }: UpdateRecordVariables) =>
      api.updateRecord(id, data),
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
