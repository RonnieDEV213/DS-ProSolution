import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys, type RecordFilters } from "@/lib/query-keys";
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
 * Infinite query hook for fetching records with cursor pagination.
 *
 * TODO: Replace with sync endpoint when Phase 18 wires IndexedDB.
 * For now, wraps api.getRecords to return format compatible with infinite query.
 *
 * @param orgId - Organization ID to scope the query
 * @param accountId - Account ID to filter records
 * @param filters - Optional filters (date range, status)
 */
export function useRecordsInfinite(
  orgId: string,
  accountId: string,
  filters?: RecordFilters
) {
  return useInfiniteQuery<RecordsPage, Error>({
    queryKey: queryKeys.records.infinite(orgId, accountId, filters),
    queryFn: async () => {
      // TODO: Replace with sync endpoint when Phase 18 wires IndexedDB
      // For now, fetch all records and return as single page
      const records = await api.getRecords({
        account_id: accountId,
        date_from: filters?.date_from,
        date_to: filters?.date_to,
        status: filters?.status,
      });

      return {
        items: records,
        nextCursor: null,
        hasMore: false,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    // Records change frequently - 30 second stale time
    staleTime: 30 * 1000,
  });
}
