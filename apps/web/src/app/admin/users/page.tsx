"use client";

import { useState } from "react";
import { UsersTable } from "@/components/admin/users-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <UsersTable
        search={search}
        statusFilter={statusFilter === "all" ? undefined : statusFilter}
        refreshTrigger={refreshTrigger}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
