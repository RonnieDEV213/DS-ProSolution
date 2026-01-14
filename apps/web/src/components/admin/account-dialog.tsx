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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null; // null = create, object = edit
  users: User[];
  onSaved: () => void;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  users,
  onSaved,
}: AccountDialogProps) {
  const [saving, setSaving] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [name, setName] = useState("");
  const [clientUserId, setClientUserId] = useState<string | null>(null);

  const isEditing = account !== null;

  // Reset form when dialog opens or account changes
  useEffect(() => {
    if (open) {
      if (account) {
        setAccountCode(account.account_code);
        setName(account.name || "");
        setClientUserId(account.client_user_id);
      } else {
        setAccountCode("");
        setName("");
        setClientUserId(null);
      }
    }
  }, [open, account]);

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
      } else {
        // Include all fields for create
        body.account_code = accountCode.trim();
        if (name) body.name = name;
        if (clientUserId) body.client_user_id = clientUserId;
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

      toast.success(isEditing ? "Account updated" : "Account created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Account" : "Create Account"}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {isEditing
              ? "Update the account details."
              : "Create a new account for tracking orders."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Account Code */}
          <div className="space-y-2">
            <Label htmlFor="account-code">Account Code</Label>
            <Input
              id="account-code"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              placeholder="e.g., ACCT001"
              disabled={isEditing}
              className="bg-gray-800 border-gray-700 font-mono"
            />
            {isEditing && (
              <p className="text-xs text-gray-500">Account code cannot be changed after creation.</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="account-name">Name (Optional)</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Store"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          {/* Client User */}
          <div className="space-y-2">
            <Label htmlFor="client-user">Client Owner (Optional)</Label>
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
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
