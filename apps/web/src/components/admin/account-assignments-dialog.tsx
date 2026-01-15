"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface AccountAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
  users: User[];
  onSaved: () => void;
}

export function AccountAssignmentsDialog({
  open,
  onOpenChange,
  account,
  users,
  onSaved,
}: AccountAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);

  // Build user lookup map
  const usersMap = new Map(users.map((u) => [u.profile.user_id, u]));

  // Get assigned user IDs
  const assignedUserIds = new Set(assignments.map((a) => a.user_id));

  // Filter available users (VAs not already assigned)
  const availableUsers = users.filter(
    (u) =>
      u.membership.role === "va" &&
      !assignedUserIds.has(u.profile.user_id)
  );

  const fetchAssignments = useCallback(async () => {
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

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}/assignments`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to fetch assignments" }));
        throw new Error(error.detail || "Failed to fetch assignments");
      }

      const data = await res.json();
      setAssignments(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    if (open) {
      fetchAssignments();
    }
  }, [open, fetchAssignments]);

  const handleAdd = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to assign");
      return;
    }

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
        body: JSON.stringify({
          user_id: selectedUserId,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to add assignment" }));
        const message = error.detail?.message || error.detail || "Failed to add assignment";
        throw new Error(message);
      }

      toast.success("VA assigned to account");
      setSelectedUserId(null);
      fetchAssignments();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add assignment");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveClick = (userId: string) => {
    setAssignmentToRemove(userId);
  };

  const handleConfirmRemove = async () => {
    if (!assignmentToRemove) return;

    setRemovingUserId(assignmentToRemove);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/accounts/${account.id}/assignments/${assignmentToRemove}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to remove assignment" }));
        throw new Error(error.detail || "Failed to remove assignment");
      }

      toast.success("VA removed from account");
      fetchAssignments();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove assignment");
    } finally {
      setRemovingUserId(null);
      setAssignmentToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setAssignmentToRemove(null);
  };

  const getUserDisplay = (userId: string) => {
    const user = usersMap.get(userId);
    if (!user) return userId.slice(0, 8) + "...";
    return user.profile.display_name || user.profile.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Manage VA Assignments</DialogTitle>
          <DialogDescription className="text-gray-400">
            Account: <span className="font-mono text-white">{account.account_code}</span>
            {account.name && ` - ${account.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add Assignment */}
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
                  {availableUsers.length === 0 ? (
                    <div className="py-2 px-2 text-sm text-gray-500">
                      No VAs available
                    </div>
                  ) : (
                    availableUsers.map((u) => (
                      <SelectItem key={u.profile.user_id} value={u.profile.user_id}>
                        {u.profile.display_name || u.profile.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={adding || !selectedUserId}
              >
                {adding ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>

          {/* Current Assignments */}
          <div className="space-y-2">
            <Label>Current Assignments</Label>
            <div className="rounded-lg border border-gray-800 bg-gray-950">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-gray-950">
                    <TableHead className="text-gray-400">VA</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500 py-4">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500 py-4">
                        No VAs assigned to this account yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => (
                      <TableRow key={assignment.user_id} className="border-gray-800">
                        <TableCell className="text-white">
                          {getUserDisplay(assignment.user_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveClick(assignment.user_id)}
                            disabled={removingUserId === assignment.user_id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            {removingUserId === assignment.user_id ? "Removing..." : "Remove"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!assignmentToRemove} onOpenChange={(open) => !open && handleCancelRemove()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove VA Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              &quot;{assignmentToRemove ? getUserDisplay(assignmentToRemove) : ""}&quot; from this account?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
