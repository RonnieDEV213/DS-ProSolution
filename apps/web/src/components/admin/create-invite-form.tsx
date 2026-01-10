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

const ACCOUNT_TYPES = ["admin", "va", "client"] as const;
const DEPARTMENTS = ["ordering", "listing", "cs", "returns", "general"] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];
type Department = (typeof DEPARTMENTS)[number];

interface CreateInviteFormProps {
  onInviteCreated?: () => void;
}

export function CreateInviteForm({ onInviteCreated }: CreateInviteFormProps) {
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("client");
  const [department, setDepartment] = useState<Department | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();

    const inviteData: {
      email: string;
      account_type: AccountType;
      department?: Department;
    } = {
      email: email.toLowerCase().trim(),
      account_type: accountType,
    };

    // Only include department for VA role
    if (accountType === "va" && department) {
      inviteData.department = department;
    }

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
      setAccountType("client");
      setDepartment("");
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
        <div className="md:col-span-1">
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
          <Label htmlFor="accountType" className="text-gray-300">
            Role
          </Label>
          <Select
            value={accountType}
            onValueChange={(v) => {
              setAccountType(v as AccountType);
              if (v !== "va") setDepartment("");
            }}
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

        {accountType === "va" && (
          <div>
            <Label htmlFor="department" className="text-gray-300">
              Department
            </Label>
            <Select
              value={department}
              onValueChange={(v) => setDepartment(v as Department)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Invite"}
      </Button>
    </form>
  );
}
