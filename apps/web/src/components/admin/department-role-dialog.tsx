"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// All available permission keys for department roles
const AVAILABLE_PERMISSIONS = [
  // Ordering Permissions
  { key: "auto_order.read", label: "Auto Order Tab", group: "Ordering Permissions" },
  { key: "order_tracking.read", label: "View Order Tracking", group: "Ordering Permissions" },
  { key: "order_tracking.write.basic_fields", label: "Edit Basic Fields", group: "Ordering Permissions" },
  { key: "order_tracking.write.order_fields", label: "Edit Order Fields", group: "Ordering Permissions" },
  { key: "order_tracking.read.order_remark", label: "View Order Remarks", group: "Ordering Permissions" },
  { key: "order_tracking.write.order_remark", label: "Edit Order Remarks", group: "Ordering Permissions" },
  { key: "order_tracking.export", label: "Export Order Tracking", group: "Ordering Permissions" },
  { key: "order_tracking.delete", label: "Delete Records", group: "Ordering Permissions" },
  // Customer Service Permissions
  { key: "order_tracking.write.service_fields", label: "Edit Service Fields", group: "Customer Service Permissions" },
  { key: "order_tracking.read.service_remark", label: "View Service Remarks", group: "Customer Service Permissions" },
  { key: "order_tracking.write.service_remark", label: "Edit Service Remarks", group: "Customer Service Permissions" },
  // Account Permissions
  { key: "accounts.view", label: "View Assigned Accounts", group: "Account Permissions" },
];

// Group permissions by category
const PERMISSION_GROUPS = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
  if (!acc[perm.group]) {
    acc[perm.group] = [];
  }
  acc[perm.group].push(perm);
  return acc;
}, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

interface DepartmentRole {
  id: string;
  org_id: string;
  name: string;
  position: number;
  permissions: string[];
  created_at: string | null;
  admin_remarks: string | null;
}

interface VA {
  profile: {
    user_id: string;
    email: string;
    display_name: string | null;
  };
  membership: {
    id: string;
    user_id: string;
    org_id: string;
    role: string;
    status: string;
  };
}

type Tab = "profile" | "permissions" | "manage-vas";

interface DepartmentRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  role: DepartmentRole | null; // null = create, object = edit
  onSaved: () => void;
  onDeleted?: () => void;
}

export function DepartmentRoleDialog({
  open,
  onOpenChange,
  orgId,
  role,
  onSaved,
  onDeleted,
}: DepartmentRoleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Tab and search state
  const [activeTab, setActiveTab] = useState<Tab>("permissions");
  const [searchQuery, setSearchQuery] = useState("");

  // VA management state
  const [allVAs, setAllVAs] = useState<VA[]>([]);
  const [assignedVAIds, setAssignedVAIds] = useState<Set<string>>(new Set());
  const [originalVAIds, setOriginalVAIds] = useState<Set<string>>(new Set());
  const [loadingVAs, setLoadingVAs] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = role !== null;

  // Fetch all VAs in the org
  const fetchAllVAs = useCallback(async () => {
    setLoadingVAs(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch(`${API_BASE}/admin/users?role=va`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Filter to only active VAs
        const activeVAs = data.users.filter(
          (u: VA) => u.membership.role === "va" && u.membership.status === "active"
        );
        setAllVAs(activeVAs);
        return activeVAs;
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingVAs(false);
    }
    return [];
  }, []);

  // Fetch VAs assigned to this profile
  const fetchAssignedVAs = useCallback(async (roleId: string, vas: VA[]) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("membership_department_roles")
        .select("membership_id")
        .eq("role_id", roleId);

      const membershipIds = data?.map((d) => d.membership_id) || [];
      const assignedIds = vas
        .filter((va) => membershipIds.includes(va.membership.id))
        .map((va) => va.membership.id);

      setAssignedVAIds(new Set(assignedIds));
      setOriginalVAIds(new Set(assignedIds));
    } catch {
      // Silently fail
    }
  }, []);

  // Reset form when dialog opens or role changes
  useEffect(() => {
    if (open) {
      setActiveTab("profile");
      setSearchQuery("");

      if (role) {
        setName(role.name);
        setAdminRemarks(role.admin_remarks || "");
        setSelectedPermissions(new Set(role.permissions));

        // Fetch VAs for edit mode
        fetchAllVAs().then((vas) => {
          if (vas.length > 0) {
            fetchAssignedVAs(role.id, vas);
          }
        });
      } else {
        setName("");
        setAdminRemarks("");
        setSelectedPermissions(new Set());
        setAssignedVAIds(new Set());
        setOriginalVAIds(new Set());

        // Fetch VAs for create mode too (so user can assign VAs immediately)
        fetchAllVAs();
      }
    }
  }, [open, role, fetchAllVAs, fetchAssignedVAs]);

  // Filter permissions based on search query
  const filteredPermissionGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return PERMISSION_GROUPS;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, typeof AVAILABLE_PERMISSIONS> = {};

    for (const [group, perms] of Object.entries(PERMISSION_GROUPS)) {
      const matchingPerms = perms.filter(
        (p) =>
          p.label.toLowerCase().includes(query) ||
          p.key.toLowerCase().includes(query) ||
          group.toLowerCase().includes(query)
      );
      if (matchingPerms.length > 0) {
        filtered[group] = matchingPerms;
      }
    }

    return filtered;
  }, [searchQuery]);

  const handlePermissionToggle = (key: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleGroupToggle = (group: string) => {
    const groupPerms = PERMISSION_GROUPS[group].map((p) => p.key);
    const allSelected = groupPerms.every((p) => selectedPermissions.has(p));

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupPerms.forEach((p) => next.delete(p));
      } else {
        groupPerms.forEach((p) => next.add(p));
      }
      return next;
    });
  };

  const handleVAToggle = (membershipId: string) => {
    setAssignedVAIds((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) {
        next.delete(membershipId);
      } else {
        next.add(membershipId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Profile name is required");
      return;
    }

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

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };

      const body: Record<string, unknown> = {
        name: name.trim(),
        permissions: Array.from(selectedPermissions),
      };

      // Include admin_remarks if it changed (for edit) or has content (for create)
      if (isEditing) {
        const originalRemarks = role.admin_remarks || "";
        if (adminRemarks !== originalRemarks) {
          body.admin_remarks = adminRemarks;
        }
      } else if (adminRemarks) {
        body.admin_remarks = adminRemarks;
      }

      const url = isEditing
        ? `${API_BASE}/admin/orgs/${orgId}/department-roles/${role.id}`
        : `${API_BASE}/admin/orgs/${orgId}/department-roles`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to save profile" }));
        const message = error.detail?.message || error.detail || "Failed to save profile";
        throw new Error(message);
      }

      // Get the role ID for VA assignments
      let roleIdForAssignments: string;
      if (isEditing) {
        roleIdForAssignments = role.id;
      } else {
        // For new profiles, get the ID from the response
        const createdRole = await res.json();
        roleIdForAssignments = createdRole.id;
      }

      // Save VA assignments
      const toAssign = [...assignedVAIds].filter((id) => !originalVAIds.has(id));
      const toUnassign = [...originalVAIds].filter((id) => !assignedVAIds.has(id));

      for (const membershipId of toAssign) {
        await fetch(`${API_BASE}/admin/orgs/${orgId}/memberships/${membershipId}/department-roles`, {
          method: "POST",
          headers,
          body: JSON.stringify({ role_id: roleIdForAssignments }),
        });
      }

      if (isEditing) {
        for (const membershipId of toUnassign) {
          await fetch(`${API_BASE}/admin/orgs/${orgId}/memberships/${membershipId}/department-roles/${roleIdForAssignments}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      }

      toast.success(isEditing ? "Access profile updated" : "Access profile created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!role) return;

    setDeleting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}/department-roles/${role.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to delete profile" }));
        throw new Error(error.detail || "Failed to delete profile");
      }

      toast.success("Access profile deleted");
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideCloseButton className="sm:max-w-3xl p-0 bg-gray-900 border-gray-800 text-white overflow-hidden">
          <div className="flex h-[500px]">
            {/* Sidebar */}
            <div className="w-52 border-r border-gray-800 flex flex-col bg-gray-950">
              {/* Header */}
              <DialogHeader className="p-4 border-b border-gray-800">
                <DialogTitle className="text-base">
                  {isEditing ? "Edit Profile" : "Create Profile"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Form to create or edit an access profile
                </DialogDescription>
              </DialogHeader>

              {/* Tab Navigation */}
              <nav className="flex-1 p-2 space-y-1">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    activeTab === "profile"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  )}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab("permissions")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    activeTab === "permissions"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  )}
                >
                  Permissions
                </button>
                <button
                  onClick={() => setActiveTab("manage-vas")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    activeTab === "manage-vas"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  )}
                >
                  Assigned VAs
                </button>
              </nav>

              {/* Delete Button (edit mode only) */}
              {isEditing && (
                <div className="p-3 border-t border-gray-800">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete Profile
                  </Button>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Profile Name</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-800 border-gray-700"
                        placeholder="Enter profile name"
                      />
                      <p className="text-xs text-gray-500">
                        The name used to identify this access profile.
                      </p>
                    </div>

                    {/* Admin Remarks */}
                    <div className="space-y-2">
                      <Label>Admin Remarks</Label>
                      <Textarea
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        className="bg-gray-800 border-gray-700 min-h-[100px]"
                        placeholder="Internal notes (only visible to admins)"
                      />
                      <p className="text-xs text-gray-500">
                        Internal notes. Only visible to admins.
                      </p>
                    </div>
                  </div>
                )}

                {/* Permissions Tab */}
                {activeTab === "permissions" && (
                  <div className="space-y-4">
                    {/* Search Bar */}
                    <Input
                      placeholder="Search permissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-gray-800 border-gray-700"
                    />

                    {/* Permission Groups Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(filteredPermissionGroups).map(([group, perms]) => {
                        const allSelected = PERMISSION_GROUPS[group].every((p) =>
                          selectedPermissions.has(p.key)
                        );
                        const someSelected = PERMISSION_GROUPS[group].some((p) =>
                          selectedPermissions.has(p.key)
                        );

                        return (
                          <div key={group} className="bg-gray-800 rounded-lg p-4">
                            {/* Group Header with Toggle All */}
                            <div
                              className="flex items-center gap-2 cursor-pointer mb-3"
                              onClick={() => handleGroupToggle(group)}
                            >
                              <Checkbox
                                checked={allSelected}
                                className={someSelected && !allSelected ? "opacity-50" : ""}
                              />
                              <span className="font-medium text-sm text-white">{group}</span>
                            </div>

                            {/* Individual Permissions */}
                            <div className="space-y-2">
                              {perms.map((perm) => (
                                <div
                                  key={perm.key}
                                  className="flex items-center gap-2 cursor-pointer hover:text-white"
                                  onClick={() => handlePermissionToggle(perm.key)}
                                >
                                  <Checkbox checked={selectedPermissions.has(perm.key)} />
                                  <span className="text-base text-gray-300">{perm.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {Object.keys(filteredPermissionGroups).length === 0 && (
                      <p className="text-gray-500 text-center py-8">
                        No permissions match your search.
                      </p>
                    )}
                  </div>
                )}

                {/* Manage VAs Tab */}
                {activeTab === "manage-vas" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      Select VAs to assign this access profile.
                    </p>

                    {loadingVAs ? (
                      <p className="text-gray-500">Loading VAs...</p>
                    ) : allVAs.length === 0 ? (
                      <p className="text-gray-500">No VAs found in the organization.</p>
                    ) : (
                      <div className="space-y-2">
                        {allVAs.map((va) => (
                          <div
                            key={va.membership.id}
                            className="flex items-center gap-3 p-3 rounded bg-gray-800 cursor-pointer hover:bg-gray-750"
                            onClick={() => handleVAToggle(va.membership.id)}
                          >
                            <Checkbox checked={assignedVAIds.has(va.membership.id)} />
                            <div>
                              <span className="text-sm font-medium text-white">
                                {va.profile.display_name || va.profile.email}
                              </span>
                              {va.profile.display_name && (
                                <p className="text-xs text-gray-400">{va.profile.email}</p>
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
              <div className="border-t border-gray-800 p-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Profile"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Access Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{role?.name}&quot;? This will remove the profile
              from all assigned VAs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
