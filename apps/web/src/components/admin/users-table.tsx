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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserEditDialog } from "./user-edit-dialog";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface User {
  profile: {
    user_id: string;
    email: string;
    display_name: string | null;
    created_at: string | null;
  };
  membership: {
    id: string;
    user_id: string;
    org_id: string;
    role: string;
    status: string;
    last_seen_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  permissions: Record<string, boolean>;
}

interface UsersTableProps {
  search: string;
  refreshTrigger: number;
  onUserUpdated: () => void;
}

export function UsersTable({
  search,
  refreshTrigger,
  onUserUpdated,
}: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const pageSize = 20;

  // Count active admins in the current user list (only count non-suspended admins)
  const activeAdminCount = users.filter(
    (u) => u.membership.role === "admin" && u.membership.status === "active"
  ).length;

  const fetchUsers = useCallback(async () => {
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

      // Store current user ID for lockout prevention
      setCurrentUserId(session.user.id);

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("page_size", pageSize.toString());

      const res = await fetch(`${API_BASE}/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to fetch users" }));
        throw new Error(error.detail || "Failed to fetch users");
      }

      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  // Fetch org info to get owner_user_id
  const fetchOrg = useCallback(async (orgId: string) => {
    setOrgLoadError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setOrgLoadError("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        setOrgLoadError(`org fetch failed: ${res.status}`);
        return;
      }

      const org = await res.json();
      setOwnerUserId(org.owner_user_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "org fetch failed";
      setOrgLoadError(msg);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers, refreshTrigger]);

  // Fetch org info when we have users (get org_id from first user)
  useEffect(() => {
    if (users.length > 0 && !ownerUserId) {
      const orgId = users[0].membership.org_id;
      fetchOrg(orgId);
    }
  }, [users, ownerUserId, fetchOrg]);

  const getRoleBadge = (user: User) => {
    // Only show owner badge if ownerUserId is definitively loaded (not null)
    const isOwner = ownerUserId !== null && user.profile.user_id === ownerUserId;
    const isSuspended = user.membership.status === "suspended";
    const roleBadge = (() => {
      switch (user.membership.role) {
        case "admin":
          return <Badge className="bg-purple-600 hover:bg-purple-600">Admin</Badge>;
        case "va":
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-blue-600 hover:bg-blue-600 cursor-help">VA</Badge>
              </TooltipTrigger>
              <TooltipContent>Virtual Assistant</TooltipContent>
            </Tooltip>
          );
        case "client":
          return <Badge className="bg-gray-600 hover:bg-gray-600">Client</Badge>;
        default:
          return <Badge variant="secondary">{user.membership.role}</Badge>;
      }
    })();

    const badges = [];
    if (isSuspended) {
      badges.push(
        <Badge key="suspended" className="bg-red-600 hover:bg-red-600">Suspended</Badge>
      );
    }
    if (isOwner) {
      badges.push(
        <Badge key="owner" className="bg-yellow-600 hover:bg-yellow-600">Owner</Badge>
      );
    }
    badges.push(<span key="role">{roleBadge}</span>);

    if (badges.length > 1) {
      return <div className="flex gap-1">{badges}</div>;
    }
    return roleBadge;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="rounded-lg border border-gray-800 bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-900">
              <TableHead className="text-gray-400">Name</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">User Type</TableHead>
              <TableHead className="text-gray-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.profile.user_id} className="border-gray-800">
                  <TableCell className="text-white font-medium">
                    {user.profile.display_name || "-"}
                  </TableCell>
                  <TableCell className="text-gray-300">{user.profile.email}</TableCell>
                  <TableCell>{getRoleBadge(user)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                        className="text-gray-400 hover:text-white"
                      >
                        Edit
                      </Button>
                      {/* Transfer button - only visible for owner and only to the owner */}
                      {ownerUserId !== null && user.profile.user_id === ownerUserId && currentUserId === ownerUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTransferDialogOpen(true)}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          Transfer
                        </Button>
                      )}
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
              {Math.min(page * pageSize, total)} of {total} users
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

      <UserEditDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSaved={() => {
          setEditingUser(null);
          onUserUpdated();
        }}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        ownerUserId={ownerUserId}
      />

      {users.length > 0 && (
        <TransferOwnershipDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          orgId={users[0].membership.org_id}
          currentOwnerId={ownerUserId}
          activeAdmins={users.filter(
            (u) => u.membership.role === "admin" && u.membership.status === "active"
          )}
          onTransferred={() => {
            setOwnerUserId(null); // Reset to refetch
            onUserUpdated();
          }}
        />
      )}
    </>
  );
}
