"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingAccount, setEditingAccount] = useState<AccountFull | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const pageSize = 20;

  // Determine if we're in view-only mode
  const isViewOnly = viewOnly || !isAdmin;

  // Fetch presence data via realtime subscription
  const { presence, loading: presenceLoading } = usePresence({
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
    // Only fetch users for admin mode
    if (isViewOnly) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // Fetch all users (for client dropdown and display)
      const res = await fetch(`${API_BASE}/admin/users?page_size=100`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      // Silently fail - users list is optional for display
    }
  }, [isViewOnly]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      if (isViewOnly) {
        // VA mode: use /accounts endpoint (returns basic info)
        const res = await fetch(`${API_BASE}/accounts`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: "Failed to fetch accounts" }));
          throw new Error(error.detail || "Failed to fetch accounts");
        }

        const data = await res.json();
        setAccounts(data);
        setTotal(data.length);
      } else {
        // Admin mode: use /admin/accounts endpoint (returns full info)
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        params.set("page", page.toString());
        params.set("page_size", pageSize.toString());

        const res = await fetch(`${API_BASE}/admin/accounts?${params}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: "Failed to fetch accounts" }));
          throw new Error(error.detail || "Failed to fetch accounts");
        }

        const data = await res.json();
        setAccounts(data.accounts);
        setTotal(data.total);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize, isViewOnly]);

  useEffect(() => {
    if (!roleLoading) {
      fetchUsers();
    }
  }, [fetchUsers, roleLoading]);

  useEffect(() => {
    if (roleLoading) return;

    const debounce = setTimeout(() => {
      fetchAccounts();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchAccounts, refreshTrigger, roleLoading]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const totalPages = Math.ceil(total / pageSize);

  // Show loading state while determining role
  if (roleLoading) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Loading...
      </div>
    );
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={isViewOnly ? 3 : 6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isViewOnly ? 3 : 6} className="py-8">
                  <FirstTimeEmpty
                    entityName="accounts"
                    description={
                      isViewOnly
                        ? "No accounts assigned to you. Contact an administrator."
                        : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => {
                const presenceEntry = presence.get(account.id);
                const isOccupied = !!presenceEntry;
                const isCurrentUser = presenceEntry?.user_id === userId;

                return (
                  <TableRow key={account.id} className="border-border">
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
                            onClick={() => setEditingAccount(account)}
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
