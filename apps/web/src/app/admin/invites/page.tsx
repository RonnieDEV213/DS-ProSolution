"use client";

import { useState } from "react";
import { CreateInviteForm } from "@/components/admin/create-invite-form";
import { InvitesList } from "@/components/admin/invites-list";

export default function AdminInvitesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleInviteCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Manage Invites</h1>
        <p className="text-gray-400 mt-2">
          Create and manage user invitations
        </p>
      </div>

      <CreateInviteForm onInviteCreated={handleInviteCreated} />
      <InvitesList refreshTrigger={refreshTrigger} />
    </div>
  );
}
