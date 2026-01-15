"use client";

import { useState } from "react";
import { UsersTable } from "@/components/admin/users-table";
import { Input } from "@/components/ui/input";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUserUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Manage Users</h1>
        <p className="text-gray-400 mt-2">
          View and manage user accounts and permissions
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      <UsersTable
        search={search}
        refreshTrigger={refreshTrigger}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
