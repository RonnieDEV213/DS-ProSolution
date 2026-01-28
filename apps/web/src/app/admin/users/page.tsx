"use client";

import { useState } from "react";
import { Shield, UserPlus } from "lucide-react";
import { UsersTable } from "@/components/admin/users-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DepartmentRoleDialog } from "@/components/admin/department-role-dialog";
import { InvitesModal } from "@/components/admin/invites-modal";

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [createProfileOpen, setCreateProfileOpen] = useState(false);
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
              onClick={() => setCreateProfileOpen(true)}
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

      <DepartmentRoleDialog
        open={createProfileOpen}
        onOpenChange={setCreateProfileOpen}
        orgId={DEFAULT_ORG_ID}
        role={null}
        onSaved={() => {
          setCreateProfileOpen(false);
          handleUserUpdated();
        }}
        onDeleted={() => {
          setCreateProfileOpen(false);
          handleUserUpdated();
        }}
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
