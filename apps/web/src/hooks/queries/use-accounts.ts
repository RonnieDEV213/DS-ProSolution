import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type Account } from "@/lib/api";

/**
 * Query hook for fetching accounts.
 * Accounts rarely change, so we use a longer stale time (5 minutes).
 *
 * @param orgId - Organization ID to scope the query
 */
export function useAccounts(orgId: string) {
  return useQuery<Account[], Error>({
    queryKey: queryKeys.accounts.list(orgId),
    queryFn: () => api.getAccounts(),
    // Accounts rarely change - 5 minute stale time
    staleTime: 5 * 60 * 1000,
  });
}
