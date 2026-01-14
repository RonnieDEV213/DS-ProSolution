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
import { AccountAssignmentsDialog } from "./account-assignments-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Account {
  id: string;
  account_code: string;
  name: string | null;
  client_user_id: string | null;
  assignment_count: number;
  created_at: string | null;
}

interface User {
  profile: {
    user_id: string;
    email: string;
    display_name: string | null;
  };
  membership: {
    role: string;
    status: string;
  };
}

interface AccountsTableProps {
  search: string;
  refreshTrigger: number;
  onAccountUpdated: () => void;
}

export function AccountsTable({
  search,
  refreshTrigger,
  onAccountUpdated,
}: AccountsTableProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignmentsAccount, setAssignmentsAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const pageSize = 20;

  // Build user lookup map
  const usersMap = new Map(
    users.map((u) => [u.profile.user_id, u])
  );

  const fetchUsers = useCallback(async () => {
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
  }, []);

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchAccounts();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchAccounts, refreshTrigger]);

  const handleDelete = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account? This will also remove all VA assignments.")) {
      return;
    }

    setDeletingAccountId(accountId);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/accounts/${accountId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to delete account" }));
        throw new Error(error.detail || "Failed to delete account");
      }

      toast.success("Account deleted");
      onAccountUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeletingAccountId(null);
    }
  };

  const getClientDisplay = (clientUserId: string | null) => {
    if (!clientUserId) return <span className="text-gray-500">-</span>;

    const user = usersMap.get(clientUserId);
    if (!user) return <span className="text-gray-400">{clientUserId.slice(0, 8)}...</span>;

    return (
      <span className="text-gray-300">
        {user.profile.display_name || user.profile.email}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Accounts</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create Account
        </Button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-900">
              <TableHead className="text-gray-400">Account Code</TableHead>
              <TableHead className="text-gray-400">Name</TableHead>
              <TableHead className="text-gray-400">Client</TableHead>
              <TableHead className="text-gray-400">VAs Assigned</TableHead>
              <TableHead className="text-gray-400">Created</TableHead>
              <TableHead className="text-gray-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No accounts found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id} className="border-gray-800">
                  <TableCell className="text-white font-medium font-mono">
                    {account.account_code}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {account.name || <span className="text-gray-500">-</span>}
                  </TableCell>
                  <TableCell>{getClientDisplay(account.client_user_id)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        account.assignment_count > 0
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-400"
                      }
                    >
                      {account.assignment_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {formatDate(account.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAssignmentsAccount(account)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Assignments
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAccount(account)}
                        className="text-gray-400 hover:text-white"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(account.id)}
                        disabled={deletingAccountId === account.id}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingAccountId === account.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <div className="text-sm text-gray-400">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, total)} of {total} accounts
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

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
      />

      {/* Assignments Dialog */}
      {assignmentsAccount && (
        <AccountAssignmentsDialog
          open={!!assignmentsAccount}
          onOpenChange={(open) => !open && setAssignmentsAccount(null)}
          account={assignmentsAccount}
          users={users}
          onSaved={() => {
            onAccountUpdated();
          }}
        />
      )}
    </>
  );
}
