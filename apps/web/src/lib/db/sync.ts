import { db, type BookkeepingRecord } from './index';
import { api, getAccessToken, type AccountSyncItem, type SellerSyncItem } from '@/lib/api';

export interface SyncResult {
  synced: number;
  deleted: number;
  hasMore: boolean;
}

/**
 * Sync records for a specific account from server to IndexedDB.
 * Uses incremental sync - only fetches records updated since last sync.
 * Handles soft deletes by removing deleted records from local cache.
 */
export async function syncRecords(accountId: string): Promise<SyncResult> {
  const metaKey = `records:${accountId}`;
  const meta = await db._sync_meta.get(metaKey);

  let cursor: string | null = meta?.cursor ?? null;
  let totalSynced = 0;
  let totalDeleted = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await api.syncRecords({
        account_id: accountId,
        cursor,
        limit: 100,
        include_deleted: true, // Need to detect server-side deletions
        updated_since: meta?.last_sync_at,
      });

      // Separate active vs deleted records
      const active: BookkeepingRecord[] = [];
      const toDelete: string[] = [];

      for (const item of response.items) {
        if (item.deleted_at) {
          toDelete.push(item.id);
        } else {
          // Map sync item to local record (status as string)
          active.push({
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
            status: item.status as string,
            return_label_cost_cents: item.return_label_cost_cents,
            order_remark: item.order_remark,
            service_remark: item.service_remark,
            updated_at: item.updated_at,
            deleted_at: item.deleted_at,
          });
        }
      }

      // Bulk upsert active records
      if (active.length > 0) {
        await db.records.bulkPut(active);
        totalSynced += active.length;
      }

      // Delete soft-deleted records locally
      if (toDelete.length > 0) {
        await db.records.bulkDelete(toDelete);
        totalDeleted += toDelete.length;
      }

      cursor = response.next_cursor;
      hasMore = response.has_more;

      // Save cursor for resume if interrupted
      if (hasMore && cursor) {
        await db._sync_meta.put({
          table_name: metaKey,
          last_sync_at: meta?.last_sync_at ?? new Date().toISOString(),
          cursor,
        });
      }
    }

    // Update sync checkpoint after complete sync
    await db._sync_meta.put({
      table_name: metaKey,
      last_sync_at: new Date().toISOString(),
      cursor: null, // Reset cursor for next incremental sync
    });

    console.log(`[Sync] Records for ${accountId}: synced=${totalSynced}, deleted=${totalDeleted}`);
    return { synced: totalSynced, deleted: totalDeleted, hasMore: false };
  } catch (error) {
    console.error(`[Sync] Failed to sync records for ${accountId}:`, error);
    throw error;
  }
}

/**
 * Sync accounts from server to IndexedDB.
 */
export async function syncAccounts(): Promise<SyncResult> {
  const metaKey = 'accounts';
  const meta = await db._sync_meta.get(metaKey);

  let cursor: string | null = meta?.cursor ?? null;
  let totalSynced = 0;
  let totalDeleted = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await api.syncAccounts({
        cursor,
        limit: 100,
        include_deleted: true,
        updated_since: meta?.last_sync_at,
      });

      const active: AccountSyncItem[] = [];
      const toDelete: string[] = [];

      for (const item of response.items) {
        if (item.deleted_at) {
          toDelete.push(item.id);
        } else {
          active.push(item);
        }
      }

      if (active.length > 0) {
        await db.accounts.bulkPut(active);
        totalSynced += active.length;
      }

      if (toDelete.length > 0) {
        await db.accounts.bulkDelete(toDelete);
        totalDeleted += toDelete.length;
      }

      cursor = response.next_cursor;
      hasMore = response.has_more;
    }

    await db._sync_meta.put({
      table_name: metaKey,
      last_sync_at: new Date().toISOString(),
      cursor: null,
    });

    console.log(`[Sync] Accounts: synced=${totalSynced}, deleted=${totalDeleted}`);
    return { synced: totalSynced, deleted: totalDeleted, hasMore: false };
  } catch (error) {
    console.error('[Sync] Failed to sync accounts:', error);
    throw error;
  }
}

/**
 * Sync sellers from server to IndexedDB.
 */
export async function syncSellers(): Promise<SyncResult> {
  const metaKey = 'sellers';
  const meta = await db._sync_meta.get(metaKey);

  let cursor: string | null = meta?.cursor ?? null;
  let totalSynced = 0;
  let totalDeleted = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await api.syncSellers({
        cursor,
        limit: 100,
        include_deleted: true,
        updated_since: meta?.last_sync_at,
      });

      const active: SellerSyncItem[] = [];
      const toDelete: string[] = [];

      for (const item of response.items) {
        if (item.deleted_at) {
          toDelete.push(item.id);
        } else {
          active.push(item);
        }
      }

      if (active.length > 0) {
        await db.sellers.bulkPut(active);
        totalSynced += active.length;
      }

      if (toDelete.length > 0) {
        await db.sellers.bulkDelete(toDelete);
        totalDeleted += toDelete.length;
      }

      cursor = response.next_cursor;
      hasMore = response.has_more;
    }

    await db._sync_meta.put({
      table_name: metaKey,
      last_sync_at: new Date().toISOString(),
      cursor: null,
    });

    console.log(`[Sync] Sellers: synced=${totalSynced}, deleted=${totalDeleted}`);
    return { synced: totalSynced, deleted: totalDeleted, hasMore: false };
  } catch (error) {
    console.error('[Sync] Failed to sync sellers:', error);
    throw error;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * Sync collection run history from server to IndexedDB.
 * Uses incremental sync - only fetches runs updated since last sync.
 * The dataset is small (typically <100 runs), so full fetches are acceptable as fallback.
 */
export async function syncCollectionRuns(): Promise<SyncResult> {
  const metaKey = 'collection_runs';
  const meta = await db._sync_meta.get(metaKey);

  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    // Fetch run history from server
    const params = new URLSearchParams();
    params.set('limit', '100');

    const response = await fetch(`${API_BASE}/collection/runs/history?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
    const data = await response.json();
    const runs = data.runs || [];

    let totalSynced = 0;
    if (runs.length > 0) {
      // Map server response to CollectionRunRecord
      const records = runs.map((run: Record<string, unknown>) => ({
        id: run.id as string,
        name: (run.name as string) || '',
        status: (run.status as string) || 'completed',
        started_at: (run.started_at as string) || null,
        completed_at: (run.completed_at as string) || null,
        departments_total: (run.departments_total as number) || 0,
        departments_completed: (run.departments_completed as number) || 0,
        categories_total: (run.categories_total as number) || 0,
        categories_completed: (run.categories_completed as number) || 0,
        categories_count: (run.categories_count as number) || 0,
        products_total: (run.products_total as number) || 0,
        products_searched: (run.products_searched as number) || 0,
        sellers_found: (run.sellers_found as number) || 0,
        sellers_new: (run.sellers_new as number) || 0,
        failed_items: (run.failed_items as number) || 0,
        duration_seconds: (run.duration_seconds as number) || null,
        category_ids: (run.category_ids as string[]) || [],
        seller_count_snapshot: (run.seller_count_snapshot as number) || null,
        updated_at: (run.updated_at as string) || (run.completed_at as string) || new Date().toISOString(),
        deleted_at: null,
      }));

      await db.collection_runs.bulkPut(records);
      totalSynced = records.length;
    }

    // Update sync checkpoint
    await db._sync_meta.put({
      table_name: metaKey,
      last_sync_at: new Date().toISOString(),
      cursor: null,
    });

    console.log(`[Sync] Collection runs: synced=${totalSynced}`);
    return { synced: totalSynced, deleted: 0, hasMore: false };
  } catch (error) {
    console.error('[Sync] Failed to sync collection runs:', error);
    throw error;
  }
}

/**
 * Get last sync time for a table.
 * Used for displaying "Last synced X ago" UI (Phase 19).
 */
export async function getLastSyncTime(tableKey: string): Promise<string | null> {
  const meta = await db._sync_meta.get(tableKey);
  return meta?.last_sync_at ?? null;
}

/**
 * Clear all local data and sync metadata.
 * Used for error recovery or user-initiated refresh.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.accounts, db.records, db.sellers, db.collection_runs, db._sync_meta, db._query_cache], async () => {
    await db.accounts.clear();
    await db.records.clear();
    await db.sellers.clear();
    await db.collection_runs.clear();
    await db._sync_meta.clear();
    await db._query_cache.clear();
  });
  console.log('[Sync] Cleared all local data');
}
