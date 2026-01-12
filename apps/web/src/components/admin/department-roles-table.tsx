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
import { DepartmentRoleDialog } from "./department-role-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Permission labels for display
const PERMISSION_LABELS: Record<string, string> = {
  "bookkeeping.read": "View Bookkeeping",
  "bookkeeping.write": "Edit Bookkeeping",
  "bookkeeping.export": "Export Bookkeeping",
  "orders.read": "View Orders",
  "orders.write": "Edit Orders",
  "returns.read": "View Returns",
  "returns.write": "Edit Returns",
};

interface DepartmentRole {
  id: string;
  org_id: string;
  name: string;
  position: number;
  permissions: string[];
  created_at: string | null;
}

interface DepartmentRolesTableProps {
  orgId: string;
  refreshTrigger: number;
  onRoleUpdated: () => void;
}

export function DepartmentRolesTable({
  orgId,
  refreshTrigger,
  onRoleUpdated,
}: DepartmentRolesTableProps) {
  const [roles, setRoles] = useState<DepartmentRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<DepartmentRole | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
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

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}/department-roles`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to fetch department roles" }));
        throw new Error(error.detail || "Failed to fetch department roles");
      }

      const data = await res.json();
      setRoles(data.roles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch department roles");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles, refreshTrigger]);

  const handleDelete = async (roleId: string) => {
    setDeletingRoleId(roleId);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}/department-roles/${roleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to delete role" }));
        throw new Error(error.detail || "Failed to delete role");
      }

      toast.success("Department role deleted");
      onRoleUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setDeletingRoleId(null);
    }
  };

  const getPermissionBadges = (permissions: string[]) => {
    if (permissions.length === 0) {
      return <span className="text-gray-500 text-sm">No permissions</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {permissions.map((perm) => (
          <Badge
            key={perm}
            variant="secondary"
            className="bg-gray-700 text-gray-300 text-xs"
          >
            {PERMISSION_LABELS[perm] || perm}
          </Badge>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Department Roles</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create Role
        </Button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-900">
              <TableHead className="text-gray-400 w-12">#</TableHead>
              <TableHead className="text-gray-400">Name</TableHead>
              <TableHead className="text-gray-400">Permissions</TableHead>
              <TableHead className="text-gray-400">Created</TableHead>
              <TableHead className="text-gray-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No department roles found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role, index) => (
                <TableRow key={role.id} className="border-gray-800">
                  <TableCell className="text-gray-500">{index + 1}</TableCell>
                  <TableCell className="text-white font-medium">{role.name}</TableCell>
                  <TableCell>{getPermissionBadges(role.permissions)}</TableCell>
                  <TableCell className="text-gray-400">{formatDate(role.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRole(role)}
                        className="text-gray-400 hover:text-white"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role.id)}
                        disabled={deletingRoleId === role.id}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingRoleId === role.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <DepartmentRoleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        orgId={orgId}
        role={null}
        onSaved={() => {
          setCreateDialogOpen(false);
          onRoleUpdated();
        }}
      />

      {/* Edit Dialog */}
      <DepartmentRoleDialog
        open={!!editingRole}
        onOpenChange={(open) => !open && setEditingRole(null)}
        orgId={orgId}
        role={editingRole}
        onSaved={() => {
          setEditingRole(null);
          onRoleUpdated();
        }}
      />
    </>
  );
}
