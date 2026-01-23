"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { InvitesList } from "@/components/admin/invites-list";

export default function AdminInvitesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleInviteCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Manage Invites</h1>
          <p className="text-gray-400 mt-2">
            Create and manage user invitations
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Invite</Button>
      </div>

      <InvitesList refreshTrigger={refreshTrigger} />

      <InviteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onInviteCreated={handleInviteCreated}
      />
    </div>
  );
}
