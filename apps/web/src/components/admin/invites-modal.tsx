"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { InvitesList } from "@/components/admin/invites-list";

interface InvitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated?: () => void;
}

export function InvitesModal({
  open,
  onOpenChange,
  onInviteCreated,
}: InvitesModalProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleInviteCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
    onInviteCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Manage Invites</DialogTitle>
              <DialogDescription>
                Create and manage user invitations
              </DialogDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>Invite</Button>
          </div>
        </DialogHeader>
        <InvitesList refreshTrigger={refreshTrigger} />
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onInviteCreated={handleInviteCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
