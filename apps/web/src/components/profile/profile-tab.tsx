"use client";

import { Label } from "@/components/ui/label";

interface ProfileTabProps {
  displayName: string | null;
  email: string;
  role: string;
}

function formatRole(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "va":
      return "Virtual Assistant";
    case "client":
      return "Client";
    default:
      return role;
  }
}

export function ProfileTab({ displayName, email, role }: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-gray-400">Display Name</Label>
        <p className="text-white text-lg">
          {displayName || email.split("@")[0]}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-gray-400">Email</Label>
        <p className="text-white text-lg">{email}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-gray-400">Role</Label>
        <p className="text-white text-lg">{formatRole(role)}</p>
      </div>
    </div>
  );
}
