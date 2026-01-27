"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { AccountsTable } from "@/components/admin/accounts-table";
import { PageHeader } from "@/components/layout/page-header";
import { PairingRequestModal } from "@/components/admin/pairing-request-modal";
import { useUserRole } from "@/hooks/use-user-role";

export default function AdminAccountsPage() {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pairingOpen, setPairingOpen] = useState(false);
  const { isAdmin } = useUserRole();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Manage Accounts"
        description="Create and manage accounts, assign clients and VAs."
        actions={
          isAdmin ? (
            <Button variant="outline" onClick={() => setPairingOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Pairing Requests
            </Button>
          ) : undefined
        }
      />

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
      />

      <PairingRequestModal
        open={pairingOpen}
        onOpenChange={setPairingOpen}
        onActionComplete={() => setRefreshTrigger((n) => n + 1)}
      />
    </div>
  );
}
