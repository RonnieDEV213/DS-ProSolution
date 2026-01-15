"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Invite {
  id: string;
  email: string;
  user_type: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
}

interface InvitesListProps {
  refreshTrigger?: number;
}

export function InvitesList({ refreshTrigger }: InvitesListProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadInvites = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setInvites(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/refresh
    void loadInvites();
  }, [loadInvites, refreshTrigger]);

  const handleRevokeClick = (invite: Invite) => {
    setInviteToRevoke(invite);
  };

  const handleConfirmRevoke = async () => {
    if (!inviteToRevoke) return;

    setRevoking(true);
    try {
      const supabase = createClient();
      await supabase.from("invites").update({ status: "revoked" }).eq("id", inviteToRevoke.id);
      loadInvites();
    } finally {
      setRevoking(false);
      setInviteToRevoke(null);
    }
  };

  const handleCancelRevoke = () => {
    setInviteToRevoke(null);
  };

  const getStatusBadge = (invite: Invite) => {
    if (invite.status === "revoked") {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (invite.status === "used") {
      return <Badge variant="secondary">Used</Badge>;
    }
    if (
      invite.status === "expired" ||
      (invite.expires_at && new Date(invite.expires_at) < new Date())
    ) {
      return <Badge variant="outline">Expired</Badge>;
    }
    return (
      <Badge className="bg-green-600 hover:bg-green-700 text-white">
        Active
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
        <p className="text-gray-400 text-center">Loading invites...</p>
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
        <p className="text-gray-400 text-center">No invites yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-900">
            <TableHead className="text-gray-400">Email</TableHead>
            <TableHead className="text-gray-400">User Type</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400">Created</TableHead>
            <TableHead className="text-gray-400">Used</TableHead>
            <TableHead className="text-gray-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id} className="border-gray-800">
              <TableCell className="text-white font-medium">
                {invite.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="uppercase">
                  {invite.user_type}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(invite)}</TableCell>
              <TableCell className="text-gray-400">
                {formatDate(invite.created_at)}
              </TableCell>
              <TableCell className="text-gray-400">
                {formatDate(invite.used_at)}
              </TableCell>
              <TableCell>
                {invite.status === "active" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeClick(invite)}
                    disabled={revoking && inviteToRevoke?.id === invite.id}
                  >
                    {revoking && inviteToRevoke?.id === invite.id ? "Revoking..." : "Revoke"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!inviteToRevoke} onOpenChange={(open) => !open && handleCancelRevoke()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invite</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the invite link for &quot;{inviteToRevoke?.email}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              className="bg-red-600 hover:bg-red-700"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
