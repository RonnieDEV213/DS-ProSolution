import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function getAccessToken(): Promise<string | null> {
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
  REFUND_NO_RETURN: "Refund (No Return)",
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
    throw new Error(error.detail || "Request failed");
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
 * Format value for display:
 * - null/undefined/empty string => "-"
 * - other => String(value)
 * Note: 0 and false display as "0" and "false", not "-"
 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "-" : trimmed;
  }
  return String(value);
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseDollars(value: string): number | null {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

export interface UserRole {
  isAdmin: boolean;
  isPending: boolean;
  isActive: boolean;
  isSuspended: boolean;
  needsAccessProfile: boolean;
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
