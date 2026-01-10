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

interface Invite {
  id: string;
  email: string;
  account_type: string;
  department: string | null;
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
    loadInvites();
  }, [loadInvites, refreshTrigger]);

  const handleRevoke = async (id: string) => {
    const supabase = createClient();
    await supabase.from("invites").update({ status: "revoked" }).eq("id", id);

    loadInvites();
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
            <TableHead className="text-gray-400">Role</TableHead>
            <TableHead className="text-gray-400">Department</TableHead>
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
                <Badge variant="outline" className="capitalize">
                  {invite.account_type}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-400">
                {invite.department ? (
                  <span className="capitalize">{invite.department}</span>
                ) : (
                  "-"
                )}
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
                    onClick={() => handleRevoke(invite.id)}
                  >
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
