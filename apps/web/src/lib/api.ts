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

export interface BookkeepingRecord {
  id: string;
  account_id: string;
  ebay_order_id: string;
  sale_date: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents: number | null;
  cogs_cents: number | null;
  tax_paid_cents: number | null;
  amazon_order_id: string | null;
  remarks: string | null;
  status: BookkeepingStatus;
  return_label_cost_cents: number | null;
  profit_cents: number;
}

export interface RecordCreate {
  account_id: string;
  ebay_order_id: string;
  sale_date: string;
  item_name: string;
  qty: number;
  sale_price_cents: number;
  ebay_fees_cents?: number | null;
  cogs_cents?: number | null;
  tax_paid_cents?: number | null;
  amazon_order_id?: string | null;
  remarks?: string | null;
  status?: BookkeepingStatus;
  return_label_cost_cents?: number | null;
}

export interface RecordUpdate {
  ebay_order_id?: string;
  sale_date?: string;
  item_name?: string;
  qty?: number;
  sale_price_cents?: number;
  ebay_fees_cents?: number | null;
  cogs_cents?: number | null;
  tax_paid_cents?: number | null;
  amazon_order_id?: string | null;
  remarks?: string | null;
  status?: BookkeepingStatus;
  return_label_cost_cents?: number | null;
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
};

// Utility functions
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseDollars(value: string): number | null {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

export function exportToCSV(
  records: BookkeepingRecord[],
  accountCode: string
): void {
  const headers = [
    "Sale Date",
    "eBay Order ID",
    "Item Name",
    "Qty",
    "Sale Price",
    "eBay Fees",
    "COGS",
    "Tax Paid",
    "Return Label",
    "Profit",
    "Amazon Order ID",
    "Status",
    "Remarks",
  ];

  const rows = records.map((r) => [
    r.sale_date,
    r.ebay_order_id,
    r.item_name,
    r.qty.toString(),
    formatCents(r.sale_price_cents),
    formatCents(r.ebay_fees_cents),
    formatCents(r.cogs_cents),
    formatCents(r.tax_paid_cents),
    formatCents(r.return_label_cost_cents),
    formatCents(r.profit_cents),
    r.amazon_order_id || "",
    r.status,
    r.remarks || "",
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
  link.download = `bookkeeping-${accountCode}-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
