import { db, type BookkeepingRecord } from './index';
import { api, type AccountSyncItem, type SellerSyncItem } from '@/lib/api';

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
  await db.transaction('rw', [db.accounts, db.records, db.sellers, db._sync_meta], async () => {
    await db.accounts.clear();
    await db.records.clear();
    await db.sellers.clear();
    await db._sync_meta.clear();
  });
  console.log('[Sync] Cleared all local data');
}
