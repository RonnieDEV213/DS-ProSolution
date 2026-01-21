"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Plus, Minus, Edit3, Bot, User } from "lucide-react";
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
}

interface ManualEditEntry {
  type: "manual_edit";
  id: string;
  action: "add" | "edit" | "remove";
  seller_name: string;
  affected_count: number;
  created_at: string;
}

type HistoryEntry = CollectionRunEntry | ManualEditEntry;

interface HistoryPanelProps {
  refreshTrigger: number;
  onStartRunClick: () => void;
  hasActiveRun: boolean;
  onManualEditClick: (logId: string) => void;
  onCollectionRunClick: (runId: string) => void;
}

const statusStyles = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

const actionIcons = {
  add: <Plus className="h-3 w-3 text-green-400" />,
  edit: <Edit3 className="h-3 w-3 text-yellow-400" />,
  remove: <Minus className="h-3 w-3 text-red-400" />,
};

export function HistoryPanel({
  refreshTrigger,
  onStartRunClick,
  hasActiveRun,
  onManualEditClick,
  onCollectionRunClick,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch both endpoints in parallel
      const [runsResponse, logsResponse] = await Promise.all([
        fetch(`${API_BASE}/collection/runs/history?limit=50`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_BASE}/sellers/audit-log?limit=50`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      const mergedEntries: HistoryEntry[] = [];

      // Process collection runs
      if (runsResponse.ok) {
        const runsData = await runsResponse.json();
        const runs = runsData.runs || [];
        for (const run of runs) {
          mergedEntries.push({
            type: "collection_run",
            id: run.id,
            name: run.name,
            started_at: run.started_at,
            completed_at: run.completed_at,
            status: run.status,
            sellers_new: run.sellers_new || 0,
            categories_count: run.categories_count || 0,
            category_ids: run.category_ids || [],
          });
        }
      }

      // Process manual edits
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        const logs = logsData.entries || [];
        for (const log of logs) {
          mergedEntries.push({
            type: "manual_edit",
            id: log.id,
            action: log.action,
            seller_name: log.seller_name,
            affected_count: log.affected_count || 1,
            created_at: log.created_at,
          });
        }
      }

      // Sort by timestamp descending (most recent first)
      mergedEntries.sort((a, b) => {
        const aTime = a.type === "collection_run"
          ? (a.completed_at || a.started_at)
          : a.created_at;
        const bTime = b.type === "collection_run"
          ? (b.completed_at || b.started_at)
          : b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      // Limit to 30 most recent entries
      setEntries(mergedEntries.slice(0, 30));
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger, fetchHistory]);

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
      className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors border-l-2 border-blue-500"
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <span className="text-gray-300 text-sm truncate flex-1">
          {entry.name}
        </span>
        <Badge className={cn("text-xs", statusStyles[entry.status])}>
          {entry.status}
        </Badge>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {entry.sellers_new > 0 && (
            <span className="text-green-400 text-xs font-medium">
              +{entry.sellers_new} sellers
            </span>
          )}
          <span className="text-gray-500 text-xs">
            {entry.categories_count} categories
          </span>
        </div>
        <span className="text-gray-500 text-xs">
          {formatDistanceToNow(new Date(getEntryTime(entry)), { addSuffix: true })}
        </span>
      </div>
    </button>
  );

  const renderManualEdit = (entry: ManualEditEntry) => (
    <button
      key={`edit-${entry.id}`}
      onClick={() => onManualEditClick(entry.id)}
      className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors border-l-2 border-gray-600"
    >
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-1.5">
          {actionIcons[entry.action]}
          <span className="text-gray-300 text-sm truncate">
            {entry.affected_count > 1
              ? `${entry.affected_count} sellers`
              : entry.seller_name}
          </span>
        </div>
      </div>
      <div className="text-gray-500 text-xs mt-1">
        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-300">History</h3>
      </div>

      {/* History entries */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-gray-500 text-sm">No activity yet</div>
        ) : (
          entries.map((entry) =>
            entry.type === "collection_run"
              ? renderCollectionRun(entry)
              : renderManualEdit(entry)
          )
        )}
      </div>

      {/* Start Run button */}
      <div className="mt-3 pt-3 border-t border-gray-800">
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
