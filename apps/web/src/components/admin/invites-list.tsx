"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
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
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { useCachedQuery } from "@/hooks/use-cached-query";
import { queryKeys } from "@/lib/query-keys";

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
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch invites via persistent cache
  const {
    data: invitesData,
    isLoading: loading,
    refetch: refetchInvites,
  } = useCachedQuery<{ invites: Invite[]; total: number }>({
    queryKey: queryKeys.admin.invites(page),
    queryFn: async () => {
      const supabase = createClient();

      // Get total count
      const { count } = await supabase
        .from("invites")
        .select("*", { count: "exact", head: true });

      // Get paginated data
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return { invites: data ?? [], total: count ?? 0 };
    },
    cacheKey: `admin:invites:${page}`,
    staleTime: 30 * 1000,
  });

  const invites = invitesData?.invites ?? [];
  const total = invitesData?.total ?? 0;

  // Re-fetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) refetchInvites();
  }, [refreshTrigger, refetchInvites]);

  const handleRevokeClick = (invite: Invite) => {
    setInviteToRevoke(invite);
  };

  const handleConfirmRevoke = async () => {
    if (!inviteToRevoke) return;

    setRevoking(true);
    try {
      const supabase = createClient();
      await supabase.from("invites").update({ status: "revoked" }).eq("id", inviteToRevoke.id);
      refetchInvites();
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

  if (loading && invites.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <TableSkeleton columns={6} rows={3} />
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <FirstTimeEmpty entityName="invites" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <Table aria-label="Pending and past invitations">
        <TableHeader>
          <TableRow className="border-border hover:bg-muted/50">
            <TableHead className="text-muted-foreground font-mono">Email</TableHead>
            <TableHead className="text-muted-foreground">User Type</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground font-mono">Created</TableHead>
            <TableHead className="text-muted-foreground font-mono">Used</TableHead>
            <TableHead className="text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id} className="border-border">
              <TableCell className="text-foreground font-medium font-mono text-sm">
                {invite.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="uppercase">
                  {invite.user_type}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(invite)}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {formatDate(invite.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
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

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, total)} of {total} invites
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
