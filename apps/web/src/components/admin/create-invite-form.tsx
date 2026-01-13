"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

interface CreateInviteFormProps {
  onInviteCreated?: () => void;
}

export function CreateInviteForm({ onInviteCreated }: CreateInviteFormProps) {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<UserType>("client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();

    const inviteData = {
      email: email.toLowerCase().trim(),
      user_type: userType,
    };

    const { error: insertError } = await supabase
      .from("invites")
      .insert(inviteData);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("An active invite already exists for this email");
      } else {
        setError(insertError.message);
      }
    } else {
      setSuccess(true);
      setEmail("");
      setUserType("client");
      onInviteCreated?.();
    }

    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 p-6 rounded-lg border border-gray-800 space-y-4"
    >
      <h2 className="text-lg font-semibold text-white">Create New Invite</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded text-sm">
          Invite created successfully!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email" className="text-gray-300">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="userType" className="text-gray-300">
            User Type
          </Label>
          <Select
            value={userType}
            onValueChange={(v) => setUserType(v as UserType)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="va">VA</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Invite"}
      </Button>
    </form>
  );
}
