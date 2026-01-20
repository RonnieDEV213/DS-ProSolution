"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Pause, XCircle, RefreshCw } from "lucide-react";

interface CollectionRun {
  id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  estimated_cost_cents: number;
  actual_cost_cents: number;
  budget_cap_cents: number;
  total_items: number;
  processed_items: number;
  failed_items: number;
  category_ids: string[];
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  created_at: string;
}

interface CollectionsTableProps {
  refreshTrigger: number;
  onActionComplete: () => void;
  onCreateClick: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

export function CollectionsTable({
  refreshTrigger,
  onActionComplete,
  onCreateClick,
}: CollectionsTableProps) {
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collection/runs`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch runs");
      }

      const data = await response.json();
      setRuns(data.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [refreshTrigger]);

  const handleAction = async (runId: string, action: "start" | "pause" | "resume" | "cancel") => {
    setActionLoading(runId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/collection/runs/${runId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `Failed to ${action} run`);
      }

      onActionComplete();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${action} run`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading collection runs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Collection Runs</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRuns}
            className="text-gray-300"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={onCreateClick}
            className="bg-blue-600 hover:bg-blue-700"
          >
            New Collection
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {runs.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-4">No collection runs yet</p>
          <Button
            onClick={onCreateClick}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Start First Collection
          </Button>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-900">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Progress</TableHead>
                <TableHead className="text-gray-400">Cost</TableHead>
                <TableHead className="text-gray-400">Started</TableHead>
                <TableHead className="text-gray-400 w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="text-white font-medium">
                    {run.name}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[run.status]}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {run.total_items > 0 ? (
                      <span>
                        {run.processed_items}/{run.total_items}
                        {run.failed_items > 0 && (
                          <span className="text-red-400 ml-1">
                            ({run.failed_items} failed)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <span>{formatCents(run.actual_cost_cents)}</span>
                    <span className="text-gray-500">
                      {" / "}
                      {formatCents(run.estimated_cost_cents)} est
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {formatDate(run.started_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={actionLoading === run.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                        {run.status === "pending" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(run.id, "start")}
                            className="text-green-400 focus:text-green-300"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </DropdownMenuItem>
                        )}
                        {run.status === "running" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(run.id, "pause")}
                            className="text-orange-400 focus:text-orange-300"
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {run.status === "paused" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(run.id, "resume")}
                            className="text-blue-400 focus:text-blue-300"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        {["pending", "running", "paused"].includes(run.status) && (
                          <DropdownMenuItem
                            onClick={() => handleAction(run.id, "cancel")}
                            className="text-red-400 focus:text-red-300"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
