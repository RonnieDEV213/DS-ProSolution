"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface User {
  profile: {
    user_id: string;
    email: string;
    display_name: string | null;
    created_at: string | null;
    admin_remarks: string | null;
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

interface DepartmentRole {
  id: string;
  org_id: string;
  name: string;
  position: number;
  permissions: string[];
  admin_remarks?: string | null;
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

type Tab = "profile" | "access-profiles";

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
  const [adminRemarks, setAdminRemarks] = useState("");
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Department roles state
  const [availableDeptRoles, setAvailableDeptRoles] = useState<DepartmentRole[]>([]);
  const [assignedDeptRoleIds, setAssignedDeptRoleIds] = useState<Set<string>>(new Set());
  const [originalDeptRoleIds, setOriginalDeptRoleIds] = useState<Set<string>>(new Set());
  const [loadingDeptRoles, setLoadingDeptRoles] = useState(false);

  // Compute lockout prevention flags
  const isSelf = user?.profile.user_id === currentUserId;
  // Only treat as owner if ownerUserId is definitively loaded (not null/undefined)
  const isOwner = ownerUserId !== null && ownerUserId !== undefined && user?.profile.user_id === ownerUserId;
  const isAdmin = user?.membership.role === "admin";
  const isLastAdmin = isAdmin && activeAdminCount <= 1;
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
      setAdminRemarks(user.profile.admin_remarks || "");
      setActiveTab("profile");

      // Fetch department roles if user is a VA
      if (user.membership.role === "va") {
        fetchAvailableDeptRoles(user.membership.org_id);
        fetchAssignedDeptRoles(user.membership.org_id, user.membership.id);
      } else {
        setAvailableDeptRoles([]);
        setAssignedDeptRoleIds(new Set());
        setOriginalDeptRoleIds(new Set());
      }
    }
  }, [user, fetchAvailableDeptRoles, fetchAssignedDeptRoles]);

  // Switch to profile tab if role changes from VA
  useEffect(() => {
    if (role !== "va" && activeTab === "access-profiles") {
      setActiveTab("profile");
    }
  }, [role, activeTab]);

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

      // Check if admin remarks changed
      const originalRemarks = user.profile.admin_remarks || "";
      if (adminRemarks !== originalRemarks) {
        updates.admin_remarks = adminRemarks;
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

  const handleSuspendClick = () => {
    setSuspendConfirmOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!user) return;
    setSuspendConfirmOpen(false);

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

      const res = await fetch(`${API_BASE}/admin/users/${user.profile.user_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "suspended" }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to suspend user" }));
        throw new Error(error.detail?.message || error.detail || "Failed to suspend user");
      }

      toast.success("User suspended");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suspend user");
    } finally {
      setSaving(false);
    }
  };

  const handleUnsuspend = async () => {
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

      const res = await fetch(`${API_BASE}/admin/users/${user.profile.user_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "active" }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to unsuspend user" }));
        throw new Error(error.detail?.message || error.detail || "Failed to unsuspend user");
      }

      toast.success("User unsuspended");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unsuspend user");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const isSuspended = user.membership.status === "suspended";
  // Can only suspend/unsuspend if not protected (self, owner, last admin)
  const canSuspend = !isProtected && !isSuspended;
  const canUnsuspend = !isProtected && isSuspended;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideCloseButton className="sm:max-w-3xl p-0 bg-card border-border text-foreground overflow-hidden">
          <div className="flex h-[500px]">
            {/* Sidebar */}
            <div className="w-52 border-r border-border flex flex-col bg-muted/50">
              {/* Header */}
              <DialogHeader className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base">Edit User</DialogTitle>
                  {isSuspended && (
                    <Badge className="bg-red-600 hover:bg-red-600 text-xs">Suspended</Badge>
                  )}
                </div>
                <DialogDescription className="sr-only">
                  Form to edit user details and permissions
                </DialogDescription>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-muted-foreground truncate cursor-default">{user.profile.email}</p>
                  </TooltipTrigger>
                  <TooltipContent>{user.profile.email}</TooltipContent>
                </Tooltip>
              </DialogHeader>

              {/* Tab Navigation */}
              <nav className="flex-1 p-2 space-y-1">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    activeTab === "profile"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  Profile
                </button>
                {role === "va" && (
                  <button
                    onClick={() => setActiveTab("access-profiles")}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                      activeTab === "access-profiles"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    Access Profiles
                  </button>
                )}
              </nav>

              {/* Suspend/Unsuspend Button */}
              {(canSuspend || canUnsuspend) && (
                <div className="p-3 border-t border-border">
                  {canSuspend && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={handleSuspendClick}
                      disabled={saving}
                    >
                      Suspend User
                    </Button>
                  )}
                  {canUnsuspend && (
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleUnsuspend}
                      disabled={saving}
                    >
                      Unsuspend User
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    {/* Lockout Prevention Warning */}
                    {isProtected && (
                      <div className="rounded-lg bg-amber-900/30 border border-amber-700 p-3">
                        <p className="text-sm text-amber-200">
                          {isSelf
                            ? "You cannot change your own role."
                            : isOwner
                              ? "This user is the organization owner. Transfer ownership to modify."
                              : "This is the last admin. Role cannot be changed."}
                        </p>
                      </div>
                    )}

                    {/* User Type */}
                    <div className="space-y-2">
                      <Label>User Type</Label>
                      <Select value={role} onValueChange={setRole} disabled={isProtected}>
                        <SelectTrigger className="bg-muted border-input">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="va">VA</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Changing user type affects their permissions and access.
                      </p>
                    </div>

                    {/* Admin Remarks */}
                    <div className="space-y-2">
                      <Label>Admin Remarks</Label>
                      <Textarea
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        className="bg-muted border-input min-h-[100px]"
                        placeholder="Internal notes (only visible to admins)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Internal notes. Only visible to admins.
                      </p>
                    </div>
                  </div>
                )}

                {/* Access Profiles Tab */}
                {activeTab === "access-profiles" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Assign access profiles to grant specific permissions.
                    </p>
                    {loadingDeptRoles ? (
                      <p className="text-sm text-muted-foreground">Loading profiles...</p>
                    ) : availableDeptRoles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No access profiles available. Create profiles in the Access Profiles page.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableDeptRoles.map((deptRole) => (
                          <div
                            key={deptRole.id}
                            className="flex items-center gap-3 p-3 rounded bg-muted cursor-pointer hover:bg-accent"
                            onClick={() => handleDeptRoleToggle(deptRole.id)}
                          >
                            <Checkbox checked={assignedDeptRoleIds.has(deptRole.id)} />
                            <div className="flex-1">
                              <span className="text-sm font-medium">{deptRole.name}</span>
                              {deptRole.permissions.length > 0 && (
                                <p className="text-xs text-muted-foreground">
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
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={suspendConfirmOpen} onOpenChange={setSuspendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend {user?.profile.email}? They will be immediately blocked from accessing the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSuspend}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? "Suspending..." : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
