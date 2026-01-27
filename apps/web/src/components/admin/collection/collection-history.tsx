/**
 * @deprecated This component has been replaced by HistoryPanel in Phase 10.
 * Functionality merged into unified history timeline.
 * See: history-panel.tsx, hierarchical-run-modal.tsx
 */
"use client";

import { useCallback } from "react";
import { getAccessToken } from "@/lib/api";
import { useSyncRunHistory } from "@/hooks/sync/use-sync-run-history";
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
import { Download, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface CollectionHistoryProps {
  refreshTrigger: number;
  onRerun: (categoryIds: string[]) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusStyles = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

export function CollectionHistory({ refreshTrigger, onRerun }: CollectionHistoryProps) {
  // Cache-first: loads instantly from IndexedDB, syncs in background
  const { runs, isLoading, refetch } = useSyncRunHistory();

  // Re-sync when refreshTrigger changes (e.g., after a run completes)
  // useSyncRunHistory syncs on mount; refreshTrigger provides manual re-fetch
  const _triggerRef = refreshTrigger; // Keep prop for interface compatibility
  void _triggerRef;

  // Filter to only completed/failed/cancelled runs for history view
  const history = runs.filter(
    (r) => r.status === "completed" || r.status === "failed" || r.status === "cancelled"
  );

  const total = history.length;

  const handleExportRun = useCallback(async (runId: string) => {
    const token = await getAccessToken();
    if (!token) return;

    const response = await fetch(
      `${API_BASE}/sellers/export?format=json&run_id=${runId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellers_run-${runId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No collection runs yet. Start one to see history here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Collection History</h3>
        <span className="text-sm text-muted-foreground">{total} total runs</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-muted-foreground">Run</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground text-right">Duration</TableHead>
              <TableHead className="text-muted-foreground text-right">Categories</TableHead>
              <TableHead className="text-muted-foreground text-right">Products</TableHead>
              <TableHead className="text-muted-foreground text-right">Sellers</TableHead>
              <TableHead className="text-muted-foreground text-right">New</TableHead>
              <TableHead className="text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id} className="hover:bg-accent/30">
                <TableCell className="text-foreground font-medium truncate max-w-[150px]">
                  {entry.name}
                </TableCell>
                <TableCell>
                  <Badge className={cn(statusStyles[entry.status as keyof typeof statusStyles])}>
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {formatDate(entry.completed_at)}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono">
                  {formatDuration(entry.duration_seconds)}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono">
                  {entry.categories_count}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono">
                  {entry.products_searched}/{entry.products_total}
                </TableCell>
                <TableCell className="text-foreground text-right font-mono">
                  {entry.sellers_found}
                </TableCell>
                <TableCell className="text-green-400 text-right font-medium">
                  +{entry.sellers_new}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportRun(entry.id)}
                      className="h-8 w-8 p-0"
                      title="Export sellers from this run"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRerun(entry.category_ids)}
                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                      title="Re-run with same categories"
                      disabled={!entry.category_ids || entry.category_ids.length === 0}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
