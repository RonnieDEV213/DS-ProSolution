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

const EXPIRATION_OPTIONS = [
  { label: "1 hour", value: 1 * 60 * 60 * 1000 },
  { label: "6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "12 hours", value: 12 * 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "3 days", value: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 days", value: 7 * 24 * 60 * 60 * 1000 },
] as const;

interface CreateInviteFormProps {
  onInviteCreated?: () => void;
}

export function CreateInviteForm({ onInviteCreated }: CreateInviteFormProps) {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<UserType>("client");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expiresIn) {
      setError("Please select an expiration time");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

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
        setError("An active invite already exists for this email");
      } else {
        setError(insertError.message);
      }
    } else {
      setSuccess(true);
      setEmail("");
      setUserType("client");
      setExpiresIn(null);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div>
          <Label htmlFor="expiresIn" className="text-gray-300">
            Expires In
          </Label>
          <Select
            value={expiresIn?.toString() ?? ""}
            onValueChange={(v) => setExpiresIn(Number(v))}
          >
            <SelectTrigger className="mt-1">
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
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Invite"}
      </Button>
    </form>
  );
}
