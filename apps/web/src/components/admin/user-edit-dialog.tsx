"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    department: string | null;
    status: string;
    last_seen_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  permissions: Record<string, boolean>;
  overrides: Record<string, boolean | null> | null;
}

interface DepartmentRole {
  id: string;
  org_id: string;
  name: string;
  position: number;
  permissions: string[];
}

interface UserEditDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  currentUserId?: string;
  activeAdminCount?: number;
  ownerUserId?: string | null;
}

const PERMISSION_LABELS: Record<string, string> = {
  can_view_bookkeeping: "View Bookkeeping",
  can_edit_bookkeeping: "Edit Bookkeeping",
  can_export_bookkeeping: "Export Bookkeeping",
  can_manage_invites: "Manage Invites",
  can_manage_users: "Manage Users",
  can_manage_account_assignments: "Manage Account Assignments",
};

export function UserEditDialog({
  user,
  open,
  onOpenChange,
  onSaved,
  currentUserId,
  activeAdminCount = 0,
  ownerUserId,
}: UserEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});

  // Department roles state
  const [availableDeptRoles, setAvailableDeptRoles] = useState<DepartmentRole[]>([]);
  const [assignedDeptRoleIds, setAssignedDeptRoleIds] = useState<Set<string>>(new Set());
  const [originalDeptRoleIds, setOriginalDeptRoleIds] = useState<Set<string>>(new Set());
  const [loadingDeptRoles, setLoadingDeptRoles] = useState(false);

  // Compute lockout prevention flags
  const isSelf = user?.profile.user_id === currentUserId;
  // Only treat as owner if ownerUserId is definitively loaded (not null/undefined)
  const isOwner = ownerUserId !== null && ownerUserId !== undefined && user?.profile.user_id === ownerUserId;
  const isActiveAdmin = user?.membership.role === "admin" && user?.membership.status === "active";
  const isLastAdmin = isActiveAdmin && activeAdminCount <= 1;
  const isProtected = isSelf || isOwner || isLastAdmin;

  // Fetch available department roles for the org
  const fetchAvailableDeptRoles = useCallback(async (orgId: string) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}/department-roles`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAvailableDeptRoles(data.roles || []);
      }
    } catch {
      // Silently fail - dept roles are optional
    }
  }, []);

  // Fetch assigned department roles for the user
  const fetchAssignedDeptRoles = useCallback(async (orgId: string, membershipId: string) => {
    setLoadingDeptRoles(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch(
        `${API_BASE}/admin/orgs/${orgId}/memberships/${membershipId}/department-roles`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const roleIds = new Set<string>((data.roles || []).map((r: DepartmentRole) => r.id));
        setAssignedDeptRoleIds(roleIds);
        setOriginalDeptRoleIds(new Set<string>(roleIds));
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingDeptRoles(false);
    }
  }, []);

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setRole(user.membership.role);
      setDepartment(user.membership.department || "none");
      setStatus(user.membership.status);
      setOverrides(user.overrides || {});

      // Fetch department roles if user is a VA
      if (user.membership.role === "va" && user.membership.status === "active") {
        fetchAvailableDeptRoles(user.membership.org_id);
        fetchAssignedDeptRoles(user.membership.org_id, user.membership.id);
      } else {
        setAvailableDeptRoles([]);
        setAssignedDeptRoleIds(new Set());
        setOriginalDeptRoleIds(new Set());
      }
    }
  }, [user, fetchAvailableDeptRoles, fetchAssignedDeptRoles]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Build update payload
      const updates: Record<string, unknown> = {};

      if (role !== user.membership.role) {
        updates.role = role;
      }
      if (department !== (user.membership.department || "none")) {
        updates.department = department === "none" ? null : department;
      }
      if (status !== user.membership.status) {
        updates.status = status;
      }

      // Check if overrides changed
      const overridesChanged = Object.keys(PERMISSION_LABELS).some(
        (key) => overrides[key] !== (user.overrides?.[key] ?? null)
      );

      if (overridesChanged) {
        updates.overrides = overrides;
      }

      // Check if department roles changed
      const rolesToAssign = [...assignedDeptRoleIds].filter((id) => !originalDeptRoleIds.has(id));
      const rolesToUnassign = [...originalDeptRoleIds].filter((id) => !assignedDeptRoleIds.has(id));
      const deptRolesChanged = rolesToAssign.length > 0 || rolesToUnassign.length > 0;

      if (Object.keys(updates).length === 0 && !deptRolesChanged) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      // Save membership updates
      if (Object.keys(updates).length > 0) {
        const res = await fetch(`${API_BASE}/admin/users/${user.profile.user_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: "Failed to update user" }));
          throw new Error(error.detail || "Failed to update user");
        }
      }

      // Save department role assignments (only for VAs)
      if (deptRolesChanged && user.membership.role === "va") {
        const orgId = user.membership.org_id;
        const membershipId = user.membership.id;

        // Assign new roles
        for (const roleId of rolesToAssign) {
          const res = await fetch(
            `${API_BASE}/admin/orgs/${orgId}/memberships/${membershipId}/department-roles`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ role_id: roleId }),
            }
          );

          if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "Failed to assign role" }));
            throw new Error(error.detail?.message || error.detail || "Failed to assign department role");
          }
        }

        // Unassign removed roles
        for (const roleId of rolesToUnassign) {
          const res = await fetch(
            `${API_BASE}/admin/orgs/${orgId}/memberships/${membershipId}/department-roles/${roleId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: "Failed to unassign role" }));
            throw new Error(error.detail?.message || error.detail || "Failed to unassign department role");
          }
        }
      }

      toast.success("User updated successfully");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleOverrideChange = (permission: string, value: boolean | null) => {
    setOverrides((prev) => ({
      ...prev,
      [permission]: value,
    }));
  };

  const handleDeptRoleToggle = (roleId: string) => {
    setAssignedDeptRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  // Cycle through: inherit (null) -> true -> false -> inherit
  const getNextOverrideValue = (current: boolean | null): boolean | null => {
    if (current === null) return true;
    if (current === true) return false;
    return null;
  };

  const getOverrideDisplay = (permission: string) => {
    const value = overrides[permission];
    const roleDefault = user?.permissions[permission] ?? false;

    if (value === null || value === undefined) {
      return (
        <span className="text-gray-400">
          Inherit ({roleDefault ? "Yes" : "No"})
        </span>
      );
    }
    return value ? (
      <span className="text-green-400">Yes (Override)</span>
    ) : (
      <span className="text-red-400">No (Override)</span>
    );
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription className="text-gray-400">
            {user.profile.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lockout Prevention Warning */}
          {isProtected && (
            <div className="rounded-lg bg-amber-900/30 border border-amber-700 p-3">
              <p className="text-sm text-amber-200">
                {isSelf
                  ? "You cannot change your own role or status."
                  : isOwner
                    ? "This user is the organization owner. Transfer ownership to modify."
                    : "This is the last active admin. Role and status cannot be changed."}
              </p>
            </div>
          )}

          {/* Role */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isProtected}>
              <SelectTrigger className="bg-gray-800 border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department (only for VA) */}
          {role === "va" && (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="ordering">Ordering</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                  <SelectItem value="cs">Customer Service</SelectItem>
                  <SelectItem value="returns">Returns</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={isProtected}>
              <SelectTrigger className="bg-gray-800 border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department Roles (only for active VAs) */}
          {role === "va" && status === "active" && (
            <div className="space-y-3">
              <Label>Department Roles</Label>
              <p className="text-sm text-gray-400">
                Assign department roles to grant specific permissions.
              </p>
              {loadingDeptRoles ? (
                <p className="text-sm text-gray-500">Loading roles...</p>
              ) : availableDeptRoles.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No department roles available. Create roles in the Department Roles page.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableDeptRoles.map((deptRole) => (
                    <div
                      key={deptRole.id}
                      className="flex items-center gap-3 p-2 rounded bg-gray-800 cursor-pointer hover:bg-gray-750"
                      onClick={() => handleDeptRoleToggle(deptRole.id)}
                    >
                      <Checkbox checked={assignedDeptRoleIds.has(deptRole.id)} />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{deptRole.name}</span>
                        {deptRole.permissions.length > 0 && (
                          <p className="text-xs text-gray-400">
                            {deptRole.permissions.length} permission{deptRole.permissions.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Permission Overrides */}
          <div className="space-y-3">
            <Label>Permission Overrides</Label>
            <p className="text-sm text-gray-400">
              Click to cycle: Inherit → Yes → No → Inherit
            </p>
            <div className="space-y-2">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded bg-gray-800 cursor-pointer hover:bg-gray-750"
                  onClick={() =>
                    handleOverrideChange(key, getNextOverrideValue(overrides[key] ?? null))
                  }
                >
                  <span className="text-sm">{label}</span>
                  <span className="text-sm">{getOverrideDisplay(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
