import Dexie, { type EntityTable } from 'dexie';
import type { AccountRecord, BookkeepingRecord, SellerRecord, CollectionRunRecord, SyncMeta, PendingMutation, QueryCacheEntry } from './schema';

// Schema version - increment to clear and resync all data
// NOTE: Version 4 adds _query_cache table for persistent TanStack Query caching
export const SCHEMA_VERSION = 4;

// Database singleton
const db = new Dexie('DSProSolution') as Dexie & {
  accounts: EntityTable<AccountRecord, 'id'>;
  records: EntityTable<BookkeepingRecord, 'id'>;
  sellers: EntityTable<SellerRecord, 'id'>;
  collection_runs: EntityTable<CollectionRunRecord, 'id'>;
  _sync_meta: EntityTable<SyncMeta, 'table_name'>;
  _pending_mutations: EntityTable<PendingMutation, 'id'>;
  _query_cache: EntityTable<QueryCacheEntry, 'key'>;
};

db.version(SCHEMA_VERSION).stores({
  // Primary key first, then indexed columns
  accounts: 'id, account_code, updated_at',
  records: 'id, account_id, [account_id+sale_date], updated_at',
  sellers: 'id, normalized_name, flagged, updated_at',
  collection_runs: 'id, status, started_at, updated_at',
  _sync_meta: 'table_name',
  _pending_mutations: 'id, record_id, table, status, timestamp',
  _query_cache: 'key',
});

export { db };
export type { AccountRecord, BookkeepingRecord, SellerRecord, CollectionRunRecord, SyncMeta, PendingMutation, QueryCacheEntry };
