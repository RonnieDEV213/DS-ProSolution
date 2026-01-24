import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { api, type RecordCreate, type BookkeepingRecord } from "@/lib/api";
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
interface CreateRecordContext {
  previousData: InfiniteRecordsData | undefined;
  tempId: string;
}

/**
 * Mutation hook for creating a new record.
 * Uses optimistic updates for instant UI feedback and retry with exponential backoff.
 *
 * @param orgId - Organization ID for cache invalidation
 * @param accountId - Account ID for cache invalidation
 */
export function useCreateRecord(orgId: string, accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.records.infinite(orgId, accountId);

  return useMutation<BookkeepingRecord, Error, RecordCreate, CreateRecordContext>({
    mutationFn: (data: RecordCreate) => api.createRecord(data),

    onMutate: async (newRecord) => {
      // Cancel in-flight queries to prevent overwrite
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous cache state for rollback
      const previousData = queryClient.getQueryData<InfiniteRecordsData>(queryKey);

      // Create optimistic record with temp ID
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticRecord: BookkeepingRecord = {
        ...newRecord,
        id: tempId,
        // Add fields that server normally provides
        ebay_fees_cents: newRecord.ebay_fees_cents ?? null,
        amazon_price_cents: newRecord.amazon_price_cents ?? null,
        amazon_tax_cents: newRecord.amazon_tax_cents ?? null,
        amazon_shipping_cents: newRecord.amazon_shipping_cents ?? null,
        amazon_order_id: newRecord.amazon_order_id ?? null,
        status: newRecord.status ?? "SUCCESSFUL",
        return_label_cost_cents: null,
        order_remark: newRecord.order_remark ?? null,
        service_remark: null,
        // Computed fields - client computes if needed, placeholder zeroes
        profit_cents: 0,
        earnings_net_cents: 0,
        cogs_total_cents: 0,
      };

      // Optimistically add to cache (prepend to first page)
      if (previousData) {
        queryClient.setQueryData<InfiniteRecordsData>(queryKey, {
          ...previousData,
          pages: previousData.pages.map((page, i) =>
            i === 0
              ? { ...page, items: [optimisticRecord, ...page.items] }
              : page
          ),
        });
      }

      // Also add to IndexedDB with temp ID (as IndexedDB record format)
      const indexedDBRecord: IndexedDBRecord = {
        id: tempId,
        account_id: newRecord.account_id,
        ebay_order_id: newRecord.ebay_order_id,
        sale_date: newRecord.sale_date,
        item_name: newRecord.item_name,
        qty: newRecord.qty,
        sale_price_cents: newRecord.sale_price_cents,
        ebay_fees_cents: newRecord.ebay_fees_cents ?? null,
        amazon_price_cents: newRecord.amazon_price_cents ?? null,
        amazon_tax_cents: newRecord.amazon_tax_cents ?? null,
        amazon_shipping_cents: newRecord.amazon_shipping_cents ?? null,
        amazon_order_id: newRecord.amazon_order_id ?? null,
        status: newRecord.status ?? "SUCCESSFUL",
        return_label_cost_cents: null,
        order_remark: newRecord.order_remark ?? null,
        service_remark: null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      await db.records.add(indexedDBRecord);

      return { previousData, tempId };
    },

    onSuccess: async (serverRecord, _vars, context) => {
      // Remove temp record from IndexedDB, add real one
      if (context?.tempId) {
        await db.records.delete(context.tempId);
      }
      // Add server record to IndexedDB (as IndexedDB record format)
      const indexedDBRecord: IndexedDBRecord = {
        id: serverRecord.id,
        account_id: serverRecord.account_id,
        ebay_order_id: serverRecord.ebay_order_id,
        sale_date: serverRecord.sale_date,
        item_name: serverRecord.item_name,
        qty: serverRecord.qty,
        sale_price_cents: serverRecord.sale_price_cents,
        ebay_fees_cents: serverRecord.ebay_fees_cents,
        amazon_price_cents: serverRecord.amazon_price_cents,
        amazon_tax_cents: serverRecord.amazon_tax_cents,
        amazon_shipping_cents: serverRecord.amazon_shipping_cents,
        amazon_order_id: serverRecord.amazon_order_id,
        status: serverRecord.status,
        return_label_cost_cents: serverRecord.return_label_cost_cents,
        order_remark: serverRecord.order_remark,
        service_remark: serverRecord.service_remark,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      await db.records.put(indexedDBRecord);
    },

    onError: async (_error, _vars, context) => {
      // Rollback cache to previous state
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      // Remove temp record from IndexedDB
      if (context?.tempId) {
        await db.records.delete(context.tempId);
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
