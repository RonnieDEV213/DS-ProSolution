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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

interface Account {
  id: string;
  account_code: string;
  name: string | null;
  client_user_id: string | null;
  assignment_count: number;
  created_at: string | null;
  admin_remarks: string | null;
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

interface Assignment {
  account_id: string;
  user_id: string;
  created_at: string | null;
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  users: User[];
  onSaved: () => void;
  onDeleted?: () => void;
}

type Tab = "profile" | "manage-vas";

export function AccountDialog({
  open,
  onOpenChange,
  account,
  users,
  onSaved,
  onDeleted,
}: AccountDialogProps) {
  const [saving, setSaving] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [name, setName] = useState("");
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [adminRemarks, setAdminRemarks] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // VA assignment state (edit mode - fetched from API)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Pending VA assignments (create mode - local state)
  const [pendingVAIds, setPendingVAIds] = useState<Set<string>>(new Set());

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordsCount, setRecordsCount] = useState<number | null>(null);
  const [loadingRecordsCount, setLoadingRecordsCount] = useState(false);

  const isEditing = account !== null;

  // Build user lookup map
  const usersMap = useMemo(
    () => new Map(users.map((u) => [u.profile.user_id, u])),
    [users]
  );

  // Available VAs (not already assigned or pending)
  const availableVAs = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.user_id));
    return users.filter(
      (u) =>
        u.membership.role === "va" &&
        !assignedIds.has(u.profile.user_id) &&
        !pendingVAIds.has(u.profile.user_id)
    );
  }, [users, assignments, pendingVAIds]);

  // Fetch assignments for edit mode
  const fetchAssignments = useCallback(async () => {
    if (!account) return;
    setLoadingAssignments(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}/assignments`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingAssignments(false);
    }
  }, [account]);

  // Reset form when dialog opens or account changes
  useEffect(() => {
    if (open) {
      if (account) {
        setAccountCode(account.account_code);
        setName(account.name || "");
        setClientUserId(account.client_user_id);
        setAdminRemarks(account.admin_remarks || "");
        setActiveTab("profile");
        fetchAssignments();
        setPendingVAIds(new Set());
      } else {
        setAccountCode("");
        setName("");
        setClientUserId(null);
        setAdminRemarks("");
        setActiveTab("profile");
        setAssignments([]);
        setPendingVAIds(new Set());
      }
      setSelectedUserId(null);
    }
  }, [open, account, fetchAssignments]);

  const getUserDisplay = (userId: string) => {
    const user = usersMap.get(userId);
    if (!user) return userId.slice(0, 8) + "...";
    return user.profile.display_name || user.profile.email;
  };

  const handleSave = async () => {
    if (!accountCode.trim()) {
      toast.error("Account code is required");
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

      const body: Record<string, unknown> = {};

      if (isEditing) {
        // Only include changed fields for update
        if (name !== (account.name || "")) {
          body.name = name || null;
        }
        if (clientUserId !== account.client_user_id) {
          body.client_user_id = clientUserId;
        }
        // Check if admin remarks changed
        const originalRemarks = account.admin_remarks || "";
        if (adminRemarks !== originalRemarks) {
          body.admin_remarks = adminRemarks;
        }
      } else {
        // Include all fields for create
        body.account_code = accountCode.trim();
        if (name) body.name = name;
        if (clientUserId) body.client_user_id = clientUserId;
        if (adminRemarks) body.admin_remarks = adminRemarks;
      }

      const url = isEditing
        ? `${API_BASE}/admin/accounts/${account.id}`
        : `${API_BASE}/admin/accounts`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to save account" }));
        const message = error.detail?.message || error.detail || "Failed to save account";
        throw new Error(message);
      }

      // Assign pending VAs after creating account
      if (!isEditing && pendingVAIds.size > 0) {
        const createdAccount = await res.json();
        const accountId = createdAccount.id;

        for (const userId of pendingVAIds) {
          await fetch(`${API_BASE}/admin/accounts/${accountId}/assignments`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: userId }),
          });
        }
      }

      toast.success(isEditing ? "Account updated" : "Account created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedUserId || !account) return;
    setAdding(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: selectedUserId }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to add VA" }));
        throw new Error(error.detail?.message || error.detail || "Failed to add VA");
      }

      toast.success("VA assigned to account");
      setSelectedUserId(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add VA");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    if (!account) return;
    setRemovingUserId(userId);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(
        `${API_BASE}/admin/accounts/${account.id}/assignments/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to remove VA" }));
        throw new Error(error.detail || "Failed to remove VA");
      }

      toast.success("VA removed from account");
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove VA");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleDeleteClick = async () => {
    if (!account) return;
    setLoadingRecordsCount(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}/records/count`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setRecordsCount(data.count);
      } else {
        setRecordsCount(0);
      }
      setDeleteConfirmOpen(true);
    } catch {
      setRecordsCount(0);
      setDeleteConfirmOpen(true);
    } finally {
      setLoadingRecordsCount(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
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

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to delete account" }));
        throw new Error(error.detail || "Failed to delete account");
      }

      const result = await res.json();
      const deletedRecords = result.records_deleted || 0;
      toast.success(
        deletedRecords > 0
          ? `Account deleted (${deletedRecords} records archived)`
          : "Account deleted"
      );
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="sm:max-w-3xl bg-gray-900 border-gray-800 text-white p-0">
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-52 border-r border-gray-800 flex flex-col">
            {/* Header */}
            <DialogHeader className="p-4 border-b border-gray-800">
              <DialogTitle>{isEditing ? "Edit Account" : "Create Account"}</DialogTitle>
              <DialogDescription className="sr-only">
                Form to create or edit an account
              </DialogDescription>
            </DialogHeader>

            {/* Tab Navigation */}
            <nav className="flex-1 p-2 space-y-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm",
                  activeTab === "profile"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab("manage-vas")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm",
                  activeTab === "manage-vas"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                Manage VAs
              </button>
            </nav>

            {/* Delete Button (edit mode only) */}
            {isEditing && (
              <div className="p-4 border-t border-gray-800">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDeleteClick}
                  disabled={deleting || loadingRecordsCount}
                >
                  {loadingRecordsCount ? "Loading..." : "Delete Account"}
                </Button>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Tab Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  {/* Account Code */}
                  <div className="space-y-2">
                    <Label>Account Code</Label>
                    <Input
                      value={accountCode}
                      onChange={(e) => setAccountCode(e.target.value)}
                      disabled={isEditing}
                      placeholder="e.g., ACCT001"
                      className="bg-gray-800 border-gray-700 font-mono"
                    />
                    {isEditing && (
                      <p className="text-xs text-gray-500">Account code cannot be changed after creation.</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label>Name (Optional)</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Main Store"
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>

                  {/* Client Owner */}
                  <div className="space-y-2">
                    <Label>Client Owner (Optional)</Label>
                    <Select
                      value={clientUserId || "none"}
                      onValueChange={(v) => setClientUserId(v === "none" ? null : v)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue placeholder="Select a client..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client assigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.profile.user_id} value={u.profile.user_id}>
                            {u.profile.display_name || u.profile.email}
                            {u.membership.role !== "client" && ` (${u.membership.role})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      The client owner can view this account and its orders.
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

              {/* Manage VAs Tab */}
              {activeTab === "manage-vas" && (
                <div className="space-y-4">
                  {/* Add VA */}
                  <div className="space-y-2">
                    <Label>Add VA to Account</Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedUserId || ""}
                        onValueChange={(v) => setSelectedUserId(v || null)}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 flex-1">
                          <SelectValue placeholder="Select a VA..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVAs.length === 0 ? (
                            <div className="py-2 px-2 text-sm text-gray-500">
                              No VAs available
                            </div>
                          ) : (
                            availableVAs.map((u) => (
                              <SelectItem key={u.profile.user_id} value={u.profile.user_id}>
                                {u.profile.display_name || u.profile.email}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={
                          isEditing
                            ? handleAddAssignment
                            : () => {
                                if (selectedUserId) {
                                  setPendingVAIds((prev) => new Set([...prev, selectedUserId]));
                                  setSelectedUserId(null);
                                }
                              }
                        }
                        disabled={isEditing ? adding || !selectedUserId : !selectedUserId}
                      >
                        {adding && isEditing ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </div>

                  {/* Current/Pending Assignments */}
                  <div className="space-y-2">
                    <Label>{isEditing ? "Current Assignments" : "VAs to Assign"}</Label>
                    {isEditing ? (
                      // Edit mode - show fetched assignments
                      loadingAssignments ? (
                        <p className="text-sm text-gray-500">Loading...</p>
                      ) : assignments.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No VAs assigned to this account yet.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {assignments.map((assignment) => (
                            <div
                              key={assignment.user_id}
                              className="flex items-center justify-between p-3 rounded bg-gray-800"
                            >
                              <span className="text-sm text-white">
                                {getUserDisplay(assignment.user_id)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAssignment(assignment.user_id)}
                                disabled={removingUserId === assignment.user_id}
                                className="text-red-400 hover:text-red-300"
                              >
                                {removingUserId === assignment.user_id
                                  ? "Removing..."
                                  : "Remove"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      // Create mode - show pending VAs
                      pendingVAIds.size === 0 ? (
                        <p className="text-sm text-gray-500">
                          No VAs selected. Add VAs above to assign them when the account is created.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {[...pendingVAIds].map((userId) => (
                            <div
                              key={userId}
                              className="flex items-center justify-between p-3 rounded bg-gray-800"
                            >
                              <span className="text-sm text-white">
                                {getUserDisplay(userId)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPendingVAIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(userId);
                                    return next;
                                  })
                                }
                                className="text-red-400 hover:text-red-300"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Account"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete &quot;{account?.account_code}&quot;?
                </p>
                {recordsCount !== null && recordsCount > 0 && (
                  <p className="text-amber-500 font-medium">
                    This account has {recordsCount.toLocaleString()} bookkeeping record
                    {recordsCount !== 1 ? "s" : ""}. Deleting the account will archive all
                    associated records. Records can be recovered within 30 days.
                  </p>
                )}
                <p>This will also remove all VA assignments. This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
    </Dialog>
  );
}
