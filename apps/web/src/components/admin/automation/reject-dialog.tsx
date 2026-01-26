"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { automationApi, PendingPairingRequest } from "@/lib/api";

interface RejectDialogProps {
  request: PendingPairingRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: () => void;
}

export function RejectDialog({
  request,
  open,
  onOpenChange,
  onRejected,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  const handleReject = async () => {
    if (!request) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setLoading(true);
    try {
      await automationApi.rejectRequest(request.id, reason.trim());
      toast.success("Request rejected");
      onOpenChange(false);
      onRejected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  const truncateId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Reject Pairing Request</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Provide a reason for rejecting this pairing request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Device ID</Label>
            <p className="font-mono text-sm text-muted-foreground bg-muted p-2 rounded">
              {request && truncateId(request.install_instance_id)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="bg-muted border-border text-foreground min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={loading || !reason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
