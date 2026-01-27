"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PairingRequestsTable } from "@/components/admin/automation/pairing-requests-table";

interface PairingRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

export function PairingRequestModal({
  open,
  onOpenChange,
  onActionComplete,
}: PairingRequestModalProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleActionComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
    onActionComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Pairing Requests</DialogTitle>
          <DialogDescription>
            Review and manage Chrome Extension pairing requests
          </DialogDescription>
        </DialogHeader>
        <PairingRequestsTable
          refreshTrigger={refreshTrigger}
          onActionComplete={handleActionComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
