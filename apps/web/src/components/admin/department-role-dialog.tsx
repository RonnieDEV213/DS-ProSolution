"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// All available permission keys for department roles
const AVAILABLE_PERMISSIONS = [
  // Ordering Permissions
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
}

interface DepartmentRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  role: DepartmentRole | null; // null = create, object = edit
  onSaved: () => void;
}

export function DepartmentRoleDialog({
  open,
  onOpenChange,
  orgId,
  role,
  onSaved,
}: DepartmentRoleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const isEditing = role !== null;

  // Reset form when dialog opens or role changes
  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setSelectedPermissions(new Set(role.permissions));
      } else {
        setName("");
        setSelectedPermissions(new Set());
      }
    }
  }, [open, role]);

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
        // Deselect all in group
        groupPerms.forEach((p) => next.delete(p));
      } else {
        // Select all in group
        groupPerms.forEach((p) => next.add(p));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
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

      const body = {
        name: name.trim(),
        permissions: Array.from(selectedPermissions),
      };

      const url = isEditing
        ? `${API_BASE}/admin/orgs/${orgId}/department-roles/${role.id}`
        : `${API_BASE}/admin/orgs/${orgId}/department-roles`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to save role" }));
        const message = error.detail?.message || error.detail || "Failed to save role";
        throw new Error(message);
      }

      toast.success(isEditing ? "Role updated successfully" : "Role created successfully");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Department Role" : "Create Department Role"}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {isEditing
              ? "Update the role name and permissions."
              : "Create a new department role for VAs."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Role Name */}
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Order Tracking VA"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <Label>Permissions</Label>
            <p className="text-sm text-gray-400">
              Select the permissions this role should have.
            </p>

            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
              const allSelected = perms.every((p) => selectedPermissions.has(p.key));
              const someSelected = perms.some((p) => selectedPermissions.has(p.key));

              return (
                <div key={group} className="space-y-2">
                  {/* Group header with toggle all */}
                  <div
                    className="flex items-center gap-2 cursor-pointer p-2 rounded bg-gray-800 hover:bg-gray-750"
                    onClick={() => handleGroupToggle(group)}
                  >
                    <Checkbox
                      checked={allSelected}
                      className={someSelected && !allSelected ? "opacity-50" : ""}
                    />
                    <span className="font-medium text-sm">{group}</span>
                  </div>

                  {/* Individual permissions */}
                  <div className="ml-6 space-y-1">
                    {perms.map((perm) => (
                      <div
                        key={perm.key}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-800"
                        onClick={() => handlePermissionToggle(perm.key)}
                      >
                        <Checkbox checked={selectedPermissions.has(perm.key)} />
                        <span className="text-sm text-gray-300">{perm.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
