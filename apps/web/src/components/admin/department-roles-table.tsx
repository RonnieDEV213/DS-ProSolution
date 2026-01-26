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
import { DepartmentRoleDialog } from "./department-role-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Permission labels for display
const PERMISSION_LABELS: Record<string, string> = {
  "order_tracking.read": "View Order Tracking",
  "order_tracking.write.basic_fields": "Edit Basic Fields",
  "order_tracking.write.order_fields": "Edit Order Fields",
  "order_tracking.write.service_fields": "Edit Service Fields",
  "order_tracking.read.order_remark": "View Order Remarks",
  "order_tracking.write.order_remark": "Edit Order Remarks",
  "order_tracking.read.service_remark": "View Service Remarks",
  "order_tracking.write.service_remark": "Edit Service Remarks",
  "order_tracking.export": "Export Order Tracking",
  "order_tracking.delete": "Delete Records",
};

interface DepartmentRole {
  id: string;
  org_id: string;
  name: string;
  position: number;
  permissions: string[];
  created_at: string | null;
  admin_remarks: string | null;
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});

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

      // Fetch assignment counts in a single batch query (avoids N+1)
      const roleIds = data.roles.map((r: DepartmentRole) => r.id);
      const counts: Record<string, number> = {};
      // Initialize all counts to 0
      roleIds.forEach((id: string) => { counts[id] = 0; });

      if (roleIds.length > 0) {
        const { data: assignments } = await supabase
          .from("membership_department_roles")
          .select("role_id")
          .in("role_id", roleIds);

        // Count client-side
        assignments?.forEach((a: { role_id: string }) => {
          counts[a.role_id] = (counts[a.role_id] || 0) + 1;
        });
      }
      setAssignmentCounts(counts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch department roles");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles, refreshTrigger]);

  const getPermissionBadges = (permissions: string[]) => {
    if (permissions.length === 0) {
      return <span className="text-muted-foreground text-sm">No permissions</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {permissions.map((perm) => (
          <Badge
            key={perm}
            variant="secondary"
            className="bg-muted text-muted-foreground font-mono text-xs"
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
        <h2 className="text-lg font-semibold text-foreground">Access Profiles</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create Profile
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table aria-label="Access profiles">
          <TableHeader>
            <TableRow className="border-border hover:bg-muted/50">
              <TableHead className="text-muted-foreground w-8"></TableHead>
              <TableHead className="text-muted-foreground w-12">#</TableHead>
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Assigned VAs</TableHead>
              <TableHead className="text-muted-foreground font-mono">Created</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No access profiles found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role, index) => {
                const isExpanded = expandedIds.has(role.id);
                return (
                  <Fragment key={role.id}>
                    {/* Main Row */}
                    <TableRow className="border-border">
                      {/* Expand Toggle */}
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground"
                          onClick={() => toggleExpanded(role.id)}
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
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="text-foreground font-medium">{role.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignmentCounts[role.id] ?? 0} VA{(assignmentCounts[role.id] ?? 0) !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{formatDate(role.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRole(role)}
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
                    </TableRow>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <TableRow key={`${role.id}-details`} className="bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground">Permissions</h4>
                            {getPermissionBadges(role.permissions)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
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
        onDeleted={() => {
          setEditingRole(null);
          onRoleUpdated();
        }}
      />
    </>
  );
}
