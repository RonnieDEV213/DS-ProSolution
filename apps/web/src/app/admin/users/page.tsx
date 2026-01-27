"use client";

import { useState } from "react";
import { Shield, UserPlus } from "lucide-react";
import { UsersTable } from "@/components/admin/users-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { AccessProfilesModal } from "@/components/admin/access-profiles-modal";
import { InvitesModal } from "@/components/admin/invites-modal";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [accessProfilesOpen, setAccessProfilesOpen] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);

  const handleUserUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Manage Users"
        description="View and manage user accounts and permissions"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAccessProfilesOpen(true)}
            >
              <Shield className="mr-2 h-4 w-4" />
              Access Profiles
            </Button>
            <Button variant="outline" onClick={() => setInvitesOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invites
            </Button>
          </div>
        }
      />

      <div className="flex gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <UsersTable
        search={search}
        refreshTrigger={refreshTrigger}
        onUserUpdated={handleUserUpdated}
      />

      <AccessProfilesModal
        open={accessProfilesOpen}
        onOpenChange={setAccessProfilesOpen}
        onRoleUpdated={handleUserUpdated}
      />

      <InvitesModal
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
        onInviteCreated={handleUserUpdated}
      />
    </div>
  );
}
