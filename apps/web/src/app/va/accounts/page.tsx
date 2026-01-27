"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { AccountsTable } from "@/components/admin/accounts-table";

export default function VAAccountsPage() {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
        <p className="text-muted-foreground mt-2">
          View your assigned accounts and their current status.
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-muted border-input"
        />
      </div>

      <AccountsTable
        search={search}
        refreshTrigger={refreshTrigger}
        onAccountUpdated={() => setRefreshTrigger((n) => n + 1)}
        viewOnly={true}
      />
    </div>
  );
}
