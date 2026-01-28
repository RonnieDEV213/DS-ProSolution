"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountDialog } from "./account-dialog";
import { useUserRole } from "@/hooks/use-user-role";
import { usePresence } from "@/hooks/use-presence";
import { OccupancyBadge } from "@/components/presence/occupancy-badge";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
import { NoResults } from "@/components/empty-states/no-results";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { automationApi, Agent, getAccessToken } from "@/lib/api";
import { useSyncAccounts } from "@/hooks/sync/use-sync-accounts";
import { useCachedQuery } from "@/hooks/use-cached-query";
import { queryKeys } from "@/lib/query-keys";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Basic account info for VAs
interface AccountBasic {
  id: string;
  account_code: string;
  name: string | null;
}

// Full account info for admins
interface AccountFull extends AccountBasic {
  client_user_id: string | null;
  assignment_count: number;
  created_at: string | null;
  admin_remarks: string | null;
}

type Account = AccountBasic | AccountFull;

// Type guard to check if account has full admin data
function isAccountFull(account: Account): account is AccountFull {
  return "assignment_count" in account;
}

interface User {
  profile: {
    user_id: string;
    email: string;
    display_name: string | null;
  };
  membership: {
    role: string;
  };
}

interface AccountsTableProps {
  search: string;
  refreshTrigger: number;
  onAccountUpdated: () => void;
  viewOnly?: boolean; // Force view-only mode
}

export function AccountsTable({
  search,
  refreshTrigger,
  onAccountUpdated,
  viewOnly = false,
}: AccountsTableProps) {
  const { isAdmin, loading: roleLoading, userId } = useUserRole();
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [page, setPage] = useState(1);
  const [editingAccount, setEditingAccount] = useState<AccountFull | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Set<string>>(new Set());
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const pageSize = 20;

  // Determine if we're in view-only mode
  const isViewOnly = viewOnly || !isAdmin;

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // --- VA mode: cache-first from IndexedDB via V3 sync ---
  const syncResult = useSyncAccounts({
    search: isViewOnly ? debouncedSearch : undefined,
  });

  // --- Admin mode: persistent cache via TanStack Query + IndexedDB ---
  const adminQuery = useCachedQuery<{ accounts: AccountFull[]; total: number }>({
    queryKey: [...queryKeys.accounts.all("default"), "admin", debouncedSearch, page],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("page", page.toString());
      params.set("page_size", pageSize.toString());

      const res = await fetch(`${API_BASE}/admin/accounts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to fetch accounts" }));
        throw new Error(error.detail || "Failed to fetch accounts");
      }

      return res.json();
    },
    cacheKey: `admin:accounts:${debouncedSearch || ''}:${page}`,
    staleTime: 30 * 1000,
    enabled: !isViewOnly && !roleLoading,
  });

  // Unified data from either source
  const accounts: Account[] = isViewOnly
    ? syncResult.accounts
    : adminQuery.data?.accounts ?? [];
  const total = isViewOnly
    ? syncResult.totalCount
    : adminQuery.data?.total ?? 0;
  const loading = isViewOnly
    ? syncResult.isLoading
    : adminQuery.isLoading;

  // Re-fetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      if (isViewOnly) {
        syncResult.refetch();
      } else {
        adminQuery.refetch();
      }
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle function for expanding/collapsing accounts
  const toggleAccount = (accountId: string) => {
    setExpandedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Fetch presence data via realtime subscription
  const { presence } = usePresence({
    orgId: orgId || "",
    enabled: !!orgId,
  });

  // Fetch org_id from membership
  useEffect(() => {
    const fetchOrgId = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setOrgId(data.org_id);
      }
    };
    fetchOrgId();
  }, []);

  const fetchUsers = useCallback(async () => {
    if (isViewOnly) return;
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/admin/users?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // Silently fail - users list is optional for display
    }
  }, [isViewOnly]);

  const fetchAgents = useCallback(async () => {
    if (isViewOnly) return;
    try {
      const result = await automationApi.getAgents();
      setAgents(result.agents);
    } catch {
      // Silently fail - agents list is optional for display
    }
  }, [isViewOnly]);

  useEffect(() => {
    if (!roleLoading) {
      fetchUsers();
      fetchAgents();
    }
  }, [fetchUsers, fetchAgents, roleLoading]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const totalPages = Math.ceil(total / pageSize);

  // Show skeleton while determining role
  if (roleLoading) {
    return <TableSkeleton columns={isViewOnly ? 3 : 7} rows={5} />;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isViewOnly ? "My Accounts" : "Accounts"}
        </h2>
        {!isViewOnly && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            Create Account
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-muted/50">
              {!isViewOnly && <TableHead className="w-8"></TableHead>}
              <TableHead className="text-muted-foreground font-mono">Account Code</TableHead>
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              {!isViewOnly && (
                <>
                  <TableHead className="text-muted-foreground">VAs Assigned</TableHead>
                  <TableHead className="text-muted-foreground font-mono">Created</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isViewOnly ? 3 : 7} className="p-0">
                  <TableSkeleton columns={isViewOnly ? 3 : 7} rows={5} />
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isViewOnly ? 3 : 7} className="py-8">
                  {search ? (
                    <NoResults searchTerm={search} />
                  ) : (
                    <FirstTimeEmpty
                      entityName="accounts"
                      description={
                        isViewOnly
                          ? "No accounts assigned to you. Contact an administrator."
                          : undefined
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const presenceEntry = presence.get(account.id);
                const isOccupied = !!presenceEntry;
                const isCurrentUser = presenceEntry?.user_id === userId;
                const accountAgents = agents.filter((agent) => agent.account_id === account.id);
                const isExpanded = expandedAccountIds.has(account.id);
                const hasAgents = accountAgents.length > 0;

                return (
                  <Fragment key={account.id}>
                    <TableRow
                      className={`border-border ${!isViewOnly && hasAgents ? "cursor-pointer hover:bg-muted/50" : ""}`}
                      onClick={() => {
                        if (!isViewOnly && hasAgents) {
                          toggleAccount(account.id);
                        }
                      }}
                    >
                      {!isViewOnly && (
                        <TableCell className="w-8">
                          {hasAgents && (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-foreground font-medium font-mono text-sm">
                        {account.account_code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.name || <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell>
                        <OccupancyBadge
                          isOccupied={isOccupied}
                          occupantName={isAdmin ? presenceEntry?.display_name : undefined}
                          clockedInAt={presenceEntry?.clocked_in_at}
                          isCurrentUser={isCurrentUser}
                          inline
                        />
                      </TableCell>
                      {!isViewOnly && isAccountFull(account) && (
                        <>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                account.assignment_count > 0
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {account.assignment_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">
                            {formatDate(account.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAccount(account);
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                    {!isViewOnly && isExpanded && accountAgents.map((agent) => (
                      <TableRow key={agent.id} className="border-border bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="text-sm">
                              {agent.label || agent.install_instance_id.slice(0, 8)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className={
                              agent.role === "EBAY_AGENT"
                                ? "bg-orange-600 text-white"
                                : agent.role === "AMAZON_AGENT"
                                ? "bg-blue-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {agent.role === "EBAY_AGENT" ? "eBay" : agent.role === "AMAZON_AGENT" ? "Amazon" : "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Badge
                            variant="secondary"
                            className={
                              agent.status === "active"
                                ? "bg-primary/20 text-primary"
                                : agent.status === "offline"
                                ? "bg-muted text-muted-foreground"
                                : agent.status === "paused"
                                ? "bg-chart-4/20 text-chart-4"
                                : "bg-destructive/20 text-destructive"
                            }
                          >
                            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {agent.last_seen_at
                            ? new Date(agent.last_seen_at).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination - only for admin mode with multiple pages */}
        {!isViewOnly && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, total)} of {total} accounts
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs - only for admin mode */}
      {!isViewOnly && (
        <>
          {/* Create Dialog */}
          <AccountDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            account={null}
            users={users}
            onSaved={() => {
              setCreateDialogOpen(false);
              onAccountUpdated();
            }}
          />

          {/* Edit Dialog */}
          <AccountDialog
            open={!!editingAccount}
            onOpenChange={(open) => !open && setEditingAccount(null)}
            account={editingAccount}
            users={users}
            onSaved={() => {
              setEditingAccount(null);
              onAccountUpdated();
            }}
            onDeleted={() => {
              setEditingAccount(null);
              onAccountUpdated();
            }}
          />
        </>
      )}
    </>
  );
}
