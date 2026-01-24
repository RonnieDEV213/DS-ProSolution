import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys, type RecordFilters } from "@/lib/query-keys";
import { api, type BookkeepingRecord, type RecordSyncItem } from "@/lib/api";

/**
 * Response shape for infinite query pages.
 */
interface RecordsPage {
  items: BookkeepingRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Compute derived fields for a record (profit, earnings, COGS).
 * Server sends raw data for sync; computed fields are calculated client-side.
 */
function computeRecordFields(item: RecordSyncItem): BookkeepingRecord {
  const salePriceCents = item.sale_price_cents ?? 0;
  const ebayFeesCents = item.ebay_fees_cents ?? 0;
  const amazonPriceCents = item.amazon_price_cents ?? 0;
  const amazonTaxCents = item.amazon_tax_cents ?? 0;
  const amazonShippingCents = item.amazon_shipping_cents ?? 0;
  const returnLabelCostCents = item.return_label_cost_cents ?? 0;

  const earningsNetCents = salePriceCents - ebayFeesCents;
  const cogsTotalCents = amazonPriceCents + amazonTaxCents + amazonShippingCents;
  const profitCents = earningsNetCents - cogsTotalCents - returnLabelCostCents;

  return {
    id: item.id,
    account_id: item.account_id,
    ebay_order_id: item.ebay_order_id,
    sale_date: item.sale_date,
    item_name: item.item_name,
    qty: item.qty,
    sale_price_cents: item.sale_price_cents,
    ebay_fees_cents: item.ebay_fees_cents,
    amazon_price_cents: item.amazon_price_cents,
    amazon_tax_cents: item.amazon_tax_cents,
    amazon_shipping_cents: item.amazon_shipping_cents,
    amazon_order_id: item.amazon_order_id,
    status: item.status,
    return_label_cost_cents: item.return_label_cost_cents,
    order_remark: item.order_remark,
    service_remark: item.service_remark,
    // Computed fields
    earnings_net_cents: earningsNetCents,
    cogs_total_cents: cogsTotalCents,
    profit_cents: profitCents,
  };
}

/**
 * Infinite query hook for fetching records with cursor pagination.
 * Uses the sync endpoint for efficient incremental fetching.
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
    queryFn: async ({ pageParam }) => {
      const response = await api.syncRecords({
        account_id: accountId,
        cursor: pageParam as string | null,
        limit: 50,
        include_deleted: false,
        status: filters?.status,
        // Note: date filters would need server-side support
        // For now, filtering done in useSyncRecords hook
      });

      return {
        items: response.items.map(computeRecordFields),
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    // Records change frequently - 30 second stale time
    staleTime: 30 * 1000,
  });
}
