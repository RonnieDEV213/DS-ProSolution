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

// Blocked Account Types
export type BlockedAccountProvider = "ebay" | "amazon";

export interface BlockedAccount {
  id: string;
  org_id: string;
  provider: BlockedAccountProvider;
  account_key: string;
  reason?: string | null;
  created_at?: string | null;
  created_by?: string | null;
}

export interface BlockAccountRequest {
  provider: BlockedAccountProvider;
  account_key: string;
  reason?: string;
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

  // Blocked Accounts
  getBlockedAccounts: () =>
    fetchAPI<{ blocked_accounts: BlockedAccount[] }>("/automation/blocked-accounts"),

  blockAccount: (data: BlockAccountRequest) =>
    fetchAPI<BlockedAccount>("/automation/blocked-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  unblockAccount: (blockedId: string) =>
    fetchAPI<{ ok: boolean }>(`/automation/blocked-accounts/${blockedId}`, {
      method: "DELETE",
    }),
};
