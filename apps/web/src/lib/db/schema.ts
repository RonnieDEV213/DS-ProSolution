// Table interfaces matching server sync models exactly
// Only store raw data - computed fields (profit_cents, etc.) are calculated on read

export interface AccountRecord {
  id: string;           // Primary key
  account_code: string;
  name: string | null;
  updated_at: string;   // ISO timestamp for sync
  deleted_at: string | null;
}

export interface BookkeepingRecord {
  id: string;           // Primary key
  account_id: string;   // Foreign key
  ebay_order_id: string;
  sale_date: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents: number | null;
  amazon_price_cents: number | null;
  amazon_tax_cents: number | null;
  amazon_shipping_cents: number | null;
  amazon_order_id: string | null;
  status: string;       // Raw status value
  return_label_cost_cents: number | null;
  order_remark: string | null;
  service_remark: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface SellerRecord {
  id: string;
  display_name: string;
  normalized_name: string;
  platform: string;
  platform_id: string | null;
  times_seen: number;
  flagged: boolean;
  updated_at: string;
  deleted_at: string | null;
}

// Sync metadata for per-table checkpoints
export interface SyncMeta {
  table_name: string;   // Primary key (e.g., "records:account-123")
  last_sync_at: string; // ISO timestamp of last successful sync
  cursor: string | null; // Opaque cursor for resuming partial sync
}
