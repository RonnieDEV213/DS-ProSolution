"use client";

import { useState } from "react";
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
  };
  membership: {
    org_id: string;
    role: string;
  };
}

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  currentOwnerId?: string | null;
  activeAdmins: User[];
  onTransferred: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  orgId,
  currentOwnerId,
  activeAdmins,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Filter out current owner from candidates
  const candidates = activeAdmins.filter(
    (u) => u.profile.user_id !== currentOwnerId
  );

  const isConfirmValid = confirmText === "TRANSFER";
  const canTransfer = selectedUserId && isConfirmValid && !transferring;

  const handleTransfer = async () => {
    if (!canTransfer) return;

    setTransferring(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(`${API_BASE}/admin/orgs/${orgId}/transfer-ownership`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_owner_user_id: selectedUserId,
          confirm: "TRANSFER",
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Failed to transfer ownership" }));
        const message = error.detail?.message || error.detail || "Failed to transfer ownership";
        throw new Error(message);
      }

      toast.success("Ownership transferred successfully");
      handleClose();
      onTransferred();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to transfer ownership");
    } finally {
      setTransferring(false);
    }
  };

  const handleClose = () => {
    setSelectedUserId("");
    setConfirmText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Transfer organization ownership to another admin. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning */}
          <div className="rounded-lg bg-red-900/30 border border-red-700 p-3">
            <p className="text-sm text-red-200">
              After transferring ownership, you will remain an admin but will no longer have owner
              privileges. Only the new owner can transfer ownership again.
            </p>
          </div>

          {/* New Owner Selection */}
          <div className="space-y-2">
            <Label>New Owner</Label>
            {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                No other admins available. Promote another user to admin first.
                </p>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-muted border-input">
                  <SelectValue placeholder="Select new owner" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((user) => (
                    <SelectItem key={user.profile.user_id} value={user.profile.user_id}>
                      {user.profile.display_name || user.profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <Label>Type &quot;TRANSFER&quot; to confirm</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="TRANSFER"
              className="bg-muted border-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!canTransfer}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {transferring ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
