"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getAccessToken } from "@/lib/api";
import { useSyncRunHistory } from "@/hooks/sync/use-sync-run-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Plus, Minus, Edit3, Bot, User, Download, Flag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Discriminated union for history entries
interface CollectionRunEntry {
  type: "collection_run";
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  status: "completed" | "failed" | "cancelled";
  sellers_new: number;
  categories_count: number;
  category_ids: string[];
  seller_count_snapshot?: number;
}

interface ManualEditEntry {
  type: "manual_edit";
  id: string;
  action: "add" | "edit" | "remove" | "export" | "flag";
  seller_name: string;
  affected_count: number;
  created_at: string;
  seller_count_snapshot?: number;
  new_value?: string;
}

type HistoryEntry = CollectionRunEntry | ManualEditEntry;

interface HistoryPanelProps {
  refreshTrigger: number;
  onStartRunClick: () => void;
  hasActiveRun: boolean;
  onManualEditClick: (logId: string) => void;
  onCollectionRunClick: (runId: string) => void;
  onHistoryClick: () => void;
}

const statusStyles = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

const actionIcons: Record<string, React.ReactNode> = {
  add: <Plus className="h-3 w-3 text-green-400" />,
  edit: <Edit3 className="h-3 w-3 text-yellow-400" />,
  remove: <Minus className="h-3 w-3 text-red-400" />,
  export: <Download className="h-3 w-3 text-purple-400" />,
  flag: <Flag className="h-3 w-3 text-yellow-400" />,
};

export function HistoryPanel({
  refreshTrigger,
  onStartRunClick,
  hasActiveRun,
  onManualEditClick,
  onCollectionRunClick,
  onHistoryClick,
}: HistoryPanelProps) {
  // Cache-first run history from IndexedDB
  const { runs, isLoading: runsLoading } = useSyncRunHistory();

  // Manual edit audit logs still fetched from server (not persisted in IndexedDB)
  const [auditLogs, setAuditLogs] = useState<ManualEditEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/sellers/audit-log?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const logsData = await response.json();
        const logs = logsData.entries || [];
        const entries: ManualEditEntry[] = logs.map((log: Record<string, unknown>) => ({
          type: "manual_edit" as const,
          id: log.id as string,
          action: log.action as "add" | "edit" | "remove" | "export" | "flag",
          seller_name: log.seller_name as string,
          affected_count: (log.affected_count as number) || 1,
          created_at: log.created_at as string,
          seller_count_snapshot: log.seller_count_snapshot as number | undefined,
          new_value: log.new_value as string | undefined,
        }));
        setAuditLogs(entries);
      }
    } catch (e) {
      console.error("Failed to fetch audit logs:", e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [refreshTrigger, fetchAuditLogs]);

  // Merge run history (from IndexedDB) with audit logs (from server), sorted by timestamp
  const entries = useMemo(() => {
    const merged: HistoryEntry[] = [];

    // Map IndexedDB runs to CollectionRunEntry
    for (const run of runs) {
      if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
        merged.push({
          type: "collection_run",
          id: run.id,
          name: run.name,
          started_at: run.started_at || "",
          completed_at: run.completed_at,
          status: run.status as "completed" | "failed" | "cancelled",
          sellers_new: run.sellers_new || 0,
          categories_count: run.categories_count || 0,
          category_ids: run.category_ids || [],
          seller_count_snapshot: run.seller_count_snapshot ?? undefined,
        });
      }
    }

    // Add audit logs
    merged.push(...auditLogs);

    // Sort by timestamp descending (most recent first)
    merged.sort((a, b) => {
      const aTime = a.type === "collection_run"
        ? (a.completed_at || a.started_at)
        : a.created_at;
      const bTime = b.type === "collection_run"
        ? (b.completed_at || b.started_at)
        : b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    // Limit to 30 most recent entries
    return merged.slice(0, 30);
  }, [runs, auditLogs]);

  const loading = runsLoading && logsLoading;

  const getEntryTime = (entry: HistoryEntry): string => {
    if (entry.type === "collection_run") {
      return entry.completed_at || entry.started_at;
    }
    return entry.created_at;
  };

  const renderCollectionRun = (entry: CollectionRunEntry) => (
    <button
      key={`run-${entry.id}`}
      onClick={() => onCollectionRunClick(entry.id)}
      className="w-full text-left px-3 py-1.5 rounded bg-card hover:bg-accent transition-colors border-l-2 border-blue-500"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <span className="text-foreground text-sm truncate flex-1">
          {entry.name}
        </span>
        <Badge className={cn("text-xs", statusStyles[entry.status])}>
          {entry.status}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground text-xs">
        <span className="font-mono">
          {formatDistanceToNow(new Date(getEntryTime(entry)), { addSuffix: true })}
        </span>
        {entry.sellers_new > 0 && (
          <span className="text-green-400 font-medium">
            +{entry.sellers_new} sellers
          </span>
        )}
      </div>
    </button>
  );

  const getManualEditLabel = (entry: ManualEditEntry): string => {
    if (entry.action === "export") {
      return `Exported ${entry.affected_count} seller${entry.affected_count !== 1 ? "s" : ""}`;
    }
    if (entry.action === "flag") {
      // Parse new_value to determine flagged/unflagged
      let flagged = true;
      if (entry.new_value) {
        try {
          const parsed = JSON.parse(entry.new_value);
          flagged = parsed.flagged ?? true;
        } catch { /* use default */ }
      }
      const verb = flagged ? "Flagged" : "Unflagged";
      return `${verb} ${entry.affected_count} seller${entry.affected_count !== 1 ? "s" : ""}`;
    }
    return entry.affected_count > 1
      ? `${entry.affected_count} sellers`
      : entry.seller_name;
  };

  const renderManualEdit = (entry: ManualEditEntry) => (
    <button
      key={`edit-${entry.id}`}
      onClick={() => onManualEditClick(entry.id)}
      className="w-full text-left px-3 py-1.5 rounded bg-card hover:bg-accent transition-colors border-l-2 border-border"
    >
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-1.5">
          {actionIcons[entry.action]}
          <span className="text-foreground text-sm truncate">
            {getManualEditLabel(entry)}
          </span>
        </div>
      </div>
      <div className="flex items-center text-muted-foreground text-xs mt-0.5">
        <span className="font-mono">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Clickable History header - opens full history viewer */}
      <button
        onClick={onHistoryClick}
        className="flex items-center gap-2 mb-3 group cursor-pointer w-full text-left"
      >
        <History className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          History
        </h3>
        <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors ml-auto">
          View all
        </span>
      </button>

      {/* History entries */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-thin">
        {loading ? (
          <div className="space-y-1 animate-fade-in">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-3 py-1.5 rounded border-l-2 border-border">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 flex-1" />
                </div>
                <Skeleton className="h-2 w-20 mt-1" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <FirstTimeEmpty
              entityName="history entries"
              description="Run a collection or add sellers to see activity here."
              actionLabel="Start Collection"
              onAction={onStartRunClick}
            />
          </div>
        ) : (
          entries.map((entry) =>
            entry.type === "collection_run"
              ? renderCollectionRun(entry)
              : renderManualEdit(entry)
          )
        )}
      </div>

      {/* Start Run button */}
      <div className="mt-3 pt-3 border-t border-border">
        <Button
          onClick={onStartRunClick}
          disabled={hasActiveRun}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {hasActiveRun ? "Run in Progress..." : "Start Collection"}
        </Button>
      </div>
    </div>
  );
}
