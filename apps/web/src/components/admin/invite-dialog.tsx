"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const USER_TYPES = ["admin", "va", "client"] as const;

type UserType = (typeof USER_TYPES)[number];

const EXPIRATION_OPTIONS = [
  { label: "1 hour", value: 1 * 60 * 60 * 1000 },
  { label: "6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "12 hours", value: 12 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "3 days", value: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 days", value: 7 * 24 * 60 * 60 * 1000 },
] as const;

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated?: () => void;
}

export function InviteDialog({
  open,
  onOpenChange,
  onInviteCreated,
}: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<UserType>("client");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail("");
      setUserType("client");
      setExpiresIn(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expiresIn) {
      toast.error("Please select an expiration time");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const expiresAt = new Date(Date.now() + expiresIn).toISOString();

    const inviteData = {
      email: email.toLowerCase().trim(),
      user_type: userType,
      expires_at: expiresAt,
    };

    const { error: insertError } = await supabase
      .from("invites")
      .insert(inviteData);

    if (insertError) {
      if (insertError.code === "23505") {
        toast.error("An active invite already exists for this email");
      } else {
        toast.error(insertError.message);
      }
    } else {
      toast.success("Invite created successfully!");
      onOpenChange(false);
      onInviteCreated?.();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Create Invite</DialogTitle>
          <DialogDescription className="sr-only">
            Form to create a new user invitation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="bg-muted border-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userType" className="text-muted-foreground">
              User Type
            </Label>
            <Select
              value={userType}
              onValueChange={(v) => setUserType(v as UserType)}
            >
              <SelectTrigger className="bg-muted border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresIn" className="text-muted-foreground">
              Expires In
            </Label>
            <Select
              value={expiresIn?.toString() ?? ""}
              onValueChange={(v) => setExpiresIn(Number(v))}
            >
              <SelectTrigger className="bg-muted border-input">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
