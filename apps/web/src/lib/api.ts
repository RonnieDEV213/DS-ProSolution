import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export interface Account {
  id: string;
  account_code: string;
  name: string | null;
}

export type BookkeepingStatus =
  | "SUCCESSFUL"
  | "RETURN_LABEL_PROVIDED"
  | "RETURN_CLOSED"
  | "REFUND_NO_RETURN";

export const STATUS_LABELS: Record<BookkeepingStatus, string> = {
  SUCCESSFUL: "Successful",
  RETURN_LABEL_PROVIDED: "Return Label",
  RETURN_CLOSED: "Return Closed",
  REFUND_NO_RETURN: "Refund",
};

export interface BookkeepingRecord {
  id: string;
  account_id: string;
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
  status: BookkeepingStatus;
  return_label_cost_cents: number | null;
  // Computed fields
  earnings_net_cents: number;
  cogs_total_cents: number;
  profit_cents: number;
  // Remarks (null if user doesn't have access)
  order_remark: string | null;
  service_remark: string | null;
}

export interface RecordCreate {
  account_id: string;
  ebay_order_id: string;
  sale_date: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents?: number | null;
  amazon_price_cents?: number | null;
  amazon_tax_cents?: number | null;
  amazon_shipping_cents?: number | null;
  amazon_order_id?: string | null;
  order_remark?: string | null;
  status?: BookkeepingStatus;
  // Note: return_label_cost_cents and service_remark not in create
}

export interface RecordUpdate {
  ebay_order_id?: string;
  sale_date?: string;
  item_name?: string;
  qty?: number;
  sale_price_cents?: number;
  ebay_fees_cents?: number | null;
  amazon_price_cents?: number | null;
  amazon_tax_cents?: number | null;
  amazon_shipping_cents?: number | null;
  amazon_order_id?: string | null;
  status?: BookkeepingStatus;
  return_label_cost_cents?: number | null;
}

export interface RemarkUpdate {
  content: string | null;
}

// ============================================================
// Sync API Types (for IndexedDB sync)
// ============================================================

export interface SyncParams {
  account_id?: string;
  cursor?: string | null;
  limit?: number;
  include_deleted?: boolean;
  updated_since?: string;
  status?: BookkeepingStatus;
  flagged?: boolean;
}

export interface SyncResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_estimate: number | null;
}

// Sync item types (raw server data without computed fields)
export interface RecordSyncItem {
  id: string;
  account_id: string;
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
  status: BookkeepingStatus;
  return_label_cost_cents: number | null;
  order_remark: string | null;
  service_remark: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccountSyncItem {
  id: string;
  account_code: string;
  name: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface SellerSyncItem {
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

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    const detail = (error as { detail?: unknown }).detail;
    let message = "Request failed";

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      const detailMessages = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            const msg = (item as { msg?: unknown }).msg;
            return typeof msg === "string" ? msg : null;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item));

      if (detailMessages.length > 0) {
        message = detailMessages.join(", ");
      }
    }

    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}

export const api = {
  // Accounts
  getAccounts: () => fetchAPI<Account[]>("/accounts"),

  // Records
  getRecords: (params: {
    account_id: string;
    date_from?: string;
    date_to?: string;
    status?: BookkeepingStatus;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set("account_id", params.account_id);
    if (params.date_from) searchParams.set("date_from", params.date_from);
    if (params.date_to) searchParams.set("date_to", params.date_to);
    if (params.status) searchParams.set("status", params.status);
    return fetchAPI<BookkeepingRecord[]>(`/records?${searchParams}`);
  },

  createRecord: (data: RecordCreate) =>
    fetchAPI<BookkeepingRecord>("/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRecord: (id: string, data: RecordUpdate) =>
    fetchAPI<BookkeepingRecord>(`/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRecord: async (id: string): Promise<void> => {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/records/${id}`, {
      method: "DELETE",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Delete failed" }));
      throw new Error(error.detail || "Delete failed");
    }
    // 204 = success, no body to parse
  },

  // Remark endpoints
  updateOrderRemark: (recordId: string, content: string | null) =>
    fetchAPI<{ content: string | null }>(`/records/${recordId}/order-remark`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  updateServiceRemark: (recordId: string, content: string | null) =>
    fetchAPI<{ content: string | null }>(`/records/${recordId}/service-remark`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  // Presence
  logoutPresence: () =>
    fetchAPI<{ status: string }>("/access-codes/logout", {
      method: "POST",
    }),

  // Sync API (for IndexedDB sync)
  syncRecords: async (params: SyncParams): Promise<SyncResponse<RecordSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.account_id) searchParams.set("account_id", params.account_id);
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.include_deleted) searchParams.set("include_deleted", "true");
    if (params.updated_since) searchParams.set("updated_since", params.updated_since);
    if (params.status) searchParams.set("status", params.status);
    return fetchAPI(`/sync/records?${searchParams}`);
  },

  syncAccounts: async (params: SyncParams): Promise<SyncResponse<AccountSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.include_deleted) searchParams.set("include_deleted", "true");
    if (params.updated_since) searchParams.set("updated_since", params.updated_since);
    return fetchAPI(`/sync/accounts?${searchParams}`);
  },

  syncSellers: async (params: SyncParams): Promise<SyncResponse<SellerSyncItem>> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.include_deleted) searchParams.set("include_deleted", "true");
    if (params.updated_since) searchParams.set("updated_since", params.updated_since);
    if (params.flagged !== undefined) searchParams.set("flagged", String(params.flagged));
    return fetchAPI(`/sync/sellers?${searchParams}`);
  },
};

// ============================================================
// Seller API Functions
// ============================================================

export const sellerApi = {
  createSeller: (name: string) =>
    fetchAPI<SellerSyncItem>("/sellers", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  createSellersBulk: (names: string[]) =>
    fetchAPI<{ success_count: number; failed_count: number; errors: string[] }>(
      "/sellers/bulk",
      {
        method: "POST",
        body: JSON.stringify({ names }),
      }
    ),

  updateSeller: (id: string, name: string) =>
    fetchAPI<SellerSyncItem>(`/sellers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteSeller: async (id: string): Promise<void> => {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      method: "DELETE",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: "Delete failed" }));
      throw new Error(error.detail || "Delete failed");
    }
    // 204 = success, no body to parse
  },

  bulkDeleteSellers: (ids: string[]) =>
    fetchAPI<{ deleted_count: number }>("/sellers/bulk/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  flagSeller: (id: string) =>
    fetchAPI<{ flagged: boolean }>(`/sellers/${id}/flag`, {
      method: "POST",
    }),
};

// Utility functions

/**
 * Normalize value for comparison:
 * - undefined => undefined
 * - null => null
 * - string => trimmed; if empty after trim => null
 * - other => as-is
 */
export function normalizeForCompare(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

/**
 * Format text value for display:
 * - null/undefined/empty string => "N/A"
 * - other => String(value)
 * Note: 0 and false display as "0" and "false", not "N/A"
 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "N/A" : trimmed;
  }
  return String(value);
}

/**
 * Format cents to dollars for display:
 * - null/undefined => "$0.00" (treat missing as zero for money fields)
 * - number => "$X.XX"
 */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "$0.00";
  if (cents < 0) return `-$${Math.abs(cents / 100).toFixed(2)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseDollars(value: string): number | null {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Format date for display:
 * - null/undefined/invalid => "—"
 * - valid date => "Jan 15, 2026" format
 */
export function formatDisplayDate(date?: string | Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export interface UserRole {
  role: string | null;
  isAdmin: boolean;
  hasAccessProfile: boolean;
}

// ============================================================
// Automation Types
// ============================================================

export interface PendingPairingRequest {
  id: string;
  install_instance_id: string;
  created_at: string;
  updated_at?: string;
  expires_at: string;
  lifetime_request_count: number;
  // Detected account info
  ebay_account_key?: string | null;
  amazon_account_key?: string | null;
  ebay_account_display?: string | null;
  amazon_account_display?: string | null;
  detected_role?: AgentRole | null;
}

export interface ApprovalRequest {
  account_id?: string;  // Required for EBAY_AGENT (or auto-created)
  ebay_agent_id?: string;  // Required for AMAZON_AGENT
  role: AgentRole;
  label?: string;
}

export interface ApprovalResponse {
  agent_id: string;
  message: string;
}

export type AgentRole = "EBAY_AGENT" | "AMAZON_AGENT";

export type AgentStatus = "active" | "paused" | "revoked" | "offline";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "revoked" | "replacing";

export interface Agent {
  id: string;
  org_id: string;
  account_id: string | null;  // For eBay agents (links to accounts)
  account_code?: string | null;  // From accounts table
  account_name?: string | null;  // From accounts table (may be null)
  ebay_agent_id?: string | null;  // For Amazon agents (links to eBay agent)
  role: AgentRole | null;
  label: string | null;
  install_instance_id: string;
  status: AgentStatus;
  approval_status: ApprovalStatus;
  ebay_account_key?: string | null;
  amazon_account_key?: string | null;
  ebay_account_display?: string | null;
  amazon_account_display?: string | null;
  replaced_by_id?: string | null;
  replaced_at?: string | null;
  last_seen_at: string | null;
  created_at: string;
}

// Available Accounts (from existing accounts table)
export interface AvailableAccount {
  id: string;
  account_code: string;
  name: string | null;
}

// Available eBay Agents (for Amazon agent assignment)
export interface AvailableEbayAgent {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string | null;
  label: string | null;
}

export type JobStatus =
  | "QUEUED"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED_NEEDS_ATTENTION"
  | "FAILED_MAX_RETRIES";

export interface AutomationJob {
  id: string;
  org_id: string;
  status: JobStatus;
  attempt_count: number;
  ebay_order_id: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents: number | null;
  sale_date: string | null;
  auto_order_url: string | null;
  amazon_order_id: string | null;
  amazon_price_cents: number | null;
  amazon_tax_cents: number | null;
  amazon_shipping_cents: number | null;
  created_by_agent_id: string;
  claimed_by_agent_id: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  failure_details: string | null;
  created_at: string;
}

export function exportToCSV(
  records: BookkeepingRecord[],
  accountCode: string
): void {
  // All columns - remarks are server-filtered based on permissions
  const headers = [
    "Sale Date",
    "eBay Order ID",
    "Item Name",
    "Qty",
    "Sale Price",
    "eBay Fees",
    "Earnings Net",
    "Amazon Price",
    "Amazon Tax",
    "Amazon Shipping",
    "COGS Total",
    "Return Label Cost",
    "Status",
    "Order Remark",
    "Service Remark",
    "Profit",
    "Amazon Order ID",
    "Account ID",
  ];

  const rows = records.map((r) => [
    r.sale_date,
    r.ebay_order_id,
    r.item_name,
    r.qty.toString(),
    formatCents(r.sale_price_cents),
    formatCents(r.ebay_fees_cents),
    formatCents(r.earnings_net_cents),
    formatCents(r.amazon_price_cents),
    formatCents(r.amazon_tax_cents),
    formatCents(r.amazon_shipping_cents),
    formatCents(r.cogs_total_cents),
    formatCents(r.return_label_cost_cents),
    STATUS_LABELS[r.status] || r.status,
    r.order_remark || "",
    r.service_remark || "",
    formatCents(r.profit_cents),
    r.amazon_order_id || "",
    r.account_id,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `order-tracking-${accountCode}-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Automation API Functions
// ============================================================

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'csv' | 'json' | 'excel';

export type ExportJobStatusType = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportParams {
  account_id: string;
  format: ExportFormat;
  columns?: string[];
  status?: BookkeepingStatus;
  date_from?: string;
  date_to?: string;
}

export interface ExportJobStatus {
  job_id: string;
  status: ExportJobStatusType;
  row_count: number | null;
  file_url: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export const EXPORT_COLUMNS = {
  essential: ['ebay_order_id', 'sale_date', 'item_name', 'sale_price_cents', 'status'],
  financial: ['ebay_order_id', 'sale_date', 'item_name', 'sale_price_cents', 'ebay_fees_cents', 'earnings_net_cents', 'amazon_price_cents', 'amazon_tax_cents', 'amazon_shipping_cents', 'cogs_total_cents', 'return_label_cost_cents', 'profit_cents', 'status'],
  all: ['id', 'ebay_order_id', 'sale_date', 'item_name', 'qty', 'sale_price_cents', 'ebay_fees_cents', 'earnings_net_cents', 'amazon_price_cents', 'amazon_tax_cents', 'amazon_shipping_cents', 'cogs_total_cents', 'amazon_order_id', 'status', 'return_label_cost_cents', 'profit_cents', 'order_remark', 'service_remark'],
} as const;

export const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  ebay_order_id: 'eBay Order ID',
  sale_date: 'Sale Date',
  item_name: 'Item Name',
  qty: 'Quantity',
  sale_price_cents: 'Sale Price',
  ebay_fees_cents: 'eBay Fees',
  earnings_net_cents: 'Earnings Net',
  amazon_price_cents: 'Amazon Price',
  amazon_tax_cents: 'Amazon Tax',
  amazon_shipping_cents: 'Amazon Shipping',
  cogs_total_cents: 'COGS Total',
  amazon_order_id: 'Amazon Order ID',
  status: 'Status',
  return_label_cost_cents: 'Return Label Cost',
  profit_cents: 'Profit',
  order_remark: 'Order Remark',
  service_remark: 'Service Remark',
};

// ============================================================
// Export API Functions
// ============================================================

export const exportApi = {
  // Streaming exports (direct download) - build URL for authenticated fetch
  getExportUrl: (params: ExportParams): string => {
    const searchParams = new URLSearchParams();
    searchParams.set('account_id', params.account_id);
    if (params.columns?.length) searchParams.set('columns', params.columns.join(','));
    if (params.status) searchParams.set('status', params.status);
    if (params.date_from) searchParams.set('date_from', params.date_from);
    if (params.date_to) searchParams.set('date_to', params.date_to);
    return `${API_BASE}/export/records/${params.format}?${searchParams}`;
  },

  // Streaming export with auth - downloads directly
  streamingExport: async (params: ExportParams): Promise<Blob> => {
    const token = await getAccessToken();
    const url = exportApi.getExportUrl(params);

    const res = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(error.detail || 'Export failed');
    }

    return res.blob();
  },

  // Background export (returns job ID)
  createBackgroundExport: (params: ExportParams) =>
    fetchAPI<{ job_id: string; status: string }>('/export/records/background', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Poll job status
  getJobStatus: (jobId: string) =>
    fetchAPI<ExportJobStatus>(`/export/jobs/${jobId}`),

  // List user's export jobs
  getExportJobs: () =>
    fetchAPI<{ jobs: ExportJobStatus[] }>('/export/jobs'),

  // Download completed background job file
  downloadBackgroundExport: async (jobId: string): Promise<Blob> => {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/export/jobs/${jobId}/download`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Download failed' }));
      throw new Error(error.detail || 'Download failed');
    }

    return res.blob();
  },
};

// ============================================================
// Import Types
// ============================================================

export type ImportFormat = 'csv' | 'json' | 'excel';

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreviewRow {
  row_number: number;
  data: Record<string, unknown>;
  is_valid: boolean;
  errors: ImportValidationError[];
}

export interface ImportValidationResponse {
  preview: ImportPreviewRow[];
  errors: ImportValidationError[];
  total_rows: number;
  valid_rows: number;
  suggested_mapping: Record<string, string>;
}

export interface ImportCommitResponse {
  batch_id: string;
  rows_imported: number;
}

export interface ImportBatch {
  id: string;
  account_id: string;
  filename: string;
  row_count: number;
  format: string;
  created_at: string;
  can_rollback: boolean;
  rolled_back_at: string | null;
}

export interface ImportRollbackWarning {
  warning: string;
  modified_count: number;
  modified_record_ids: string[];
  requires_confirmation: boolean;
}

export interface ImportRollbackResponse {
  success: boolean;
  rows_deleted: number;
  warning?: ImportRollbackWarning;
}

// Known importable fields
export const IMPORT_FIELDS = [
  { field: 'ebay_order_id', label: 'eBay Order ID', required: true },
  { field: 'sale_date', label: 'Sale Date', required: true },
  { field: 'item_name', label: 'Item Name', required: true },
  { field: 'qty', label: 'Quantity', required: false },
  { field: 'sale_price_cents', label: 'Sale Price (cents)', required: true },
  { field: 'ebay_fees_cents', label: 'eBay Fees (cents)', required: false },
  { field: 'amazon_price_cents', label: 'Amazon Price (cents)', required: false },
  { field: 'amazon_tax_cents', label: 'Amazon Tax (cents)', required: false },
  { field: 'amazon_shipping_cents', label: 'Amazon Shipping (cents)', required: false },
  { field: 'amazon_order_id', label: 'Amazon Order ID', required: false },
  { field: 'status', label: 'Status', required: false },
  { field: 'order_remark', label: 'Order Remark', required: false },
] as const;

export const importApi = {
  // Validate file and get preview with suggested mapping
  validateFile: async (file: File, format: ImportFormat): Promise<ImportValidationResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/import/records/validate?format=${format}`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Validation failed' }));
      throw new Error(error.detail || 'Validation failed');
    }

    return res.json();
  },

  // Commit import with user-confirmed mapping
  commitImport: async (
    file: File,
    accountId: string,
    format: ImportFormat,
    columnMapping: Record<string, string>
  ): Promise<ImportCommitResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('account_id', accountId);
    formData.append('filename', file.name);
    formData.append('format', format);
    formData.append('column_mapping', JSON.stringify(columnMapping));

    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/import/records/commit`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Import failed' }));
      // Handle both string and object error formats
      const detail = error.detail;
      if (typeof detail === 'string') {
        throw new Error(detail);
      } else if (detail?.message) {
        // Object format: { message: string, errors: string[] }
        const errorList = detail.errors?.join('; ') || '';
        throw new Error(errorList ? `${detail.message}: ${errorList}` : detail.message);
      }
      throw new Error('Import failed');
    }

    return res.json();
  },

  // Get import history
  getImportBatches: (accountId?: string) =>
    fetchAPI<{ batches: ImportBatch[] }>(
      `/import/batches${accountId ? `?account_id=${accountId}` : ''}`
    ),

  // Rollback import
  rollbackImport: (batchId: string, force: boolean = false) =>
    fetchAPI<ImportRollbackResponse>(`/import/batches/${batchId}/rollback?force=${force}`, {
      method: 'POST',
    }),
};

// ============================================================
// Automation Types
// ============================================================

export const automationApi = {
  // Available Accounts (from existing accounts table)
  getAvailableAccounts: () =>
    fetchAPI<{ accounts: AvailableAccount[] }>("/automation/available-accounts"),

  // Available eBay Agents (for Amazon agent assignment)
  getAvailableEbayAgents: () =>
    fetchAPI<{ ebay_agents: AvailableEbayAgent[] }>("/automation/available-ebay-agents"),

  // Pairing Requests
  getPendingRequests: () =>
    fetchAPI<{ requests: PendingPairingRequest[] }>("/automation/pairing/requests"),

  approveRequest: (requestId: string, data: ApprovalRequest) =>
    fetchAPI<ApprovalResponse>(`/automation/pairing/requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rejectRequest: (requestId: string, reason: string) =>
    fetchAPI<{ ok: boolean }>(`/automation/pairing/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Agents
  getAgents: () =>
    fetchAPI<{ agents: Agent[] }>("/automation/agents"),

  updateAgent: (agentId: string, data: { label?: string }) =>
    fetchAPI<Agent>(`/automation/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  revokeAgent: (agentId: string) =>
    fetchAPI<{ ok: boolean; message: string }>(`/automation/agents/${agentId}/revoke`, {
      method: "POST",
    }),

  deleteAgent: (agentId: string) =>
    fetchAPI<{ ok: boolean }>(`/automation/agents/${agentId}`, {
      method: "DELETE",
    }),

  // Jobs
  getJobs: (params: { status?: JobStatus; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("page_size", params.pageSize.toString());
    return fetchAPI<{ jobs: AutomationJob[]; total: number; page: number; page_size: number }>(
      `/automation/jobs?${searchParams}`
    );
  },
};
