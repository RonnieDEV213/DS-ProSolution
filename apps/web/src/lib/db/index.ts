import Dexie, { type EntityTable } from 'dexie';
import type { AccountRecord, BookkeepingRecord, SellerRecord, SyncMeta } from './schema';

// Schema version - increment to clear and resync all data
export const SCHEMA_VERSION = 1;

// Database singleton
const db = new Dexie('DSProSolution') as Dexie & {
  accounts: EntityTable<AccountRecord, 'id'>;
  records: EntityTable<BookkeepingRecord, 'id'>;
  sellers: EntityTable<SellerRecord, 'id'>;
  _sync_meta: EntityTable<SyncMeta, 'table_name'>;
};

db.version(SCHEMA_VERSION).stores({
  // Primary key first, then indexed columns
  accounts: 'id, account_code, updated_at',
  records: 'id, account_id, [account_id+sale_date], updated_at',
  sellers: 'id, normalized_name, flagged, updated_at',
  _sync_meta: 'table_name',
});

export { db };
export type { AccountRecord, BookkeepingRecord, SellerRecord, SyncMeta };
