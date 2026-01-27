"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Edit3, Bot, FileQuestion } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Manual edit log entry
interface ManualLogEntry {
  type: "manual_edit";
  id: string;
  action: "add" | "edit" | "remove";
  seller_name: string;
  source: string;
  affected_count: number;
  created_at: string;
}

// Collection run entry
interface CollectionRunEntry {
  type: "collection_run";
  id: string;
  name: string;
  started_at: string;
  completed_at: string | null;
  status: "completed" | "failed" | "cancelled";
  sellers_new: number;
  categories_count: number;
}

type HistoryEntry = ManualLogEntry | CollectionRunEntry;

// Changes type for diff display
interface SellerChanges {
  added: string[];
  removed: string[];
}

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogId: string | null;
  selectedRunId?: string | null;
}

const actionColors = {
  add: "text-green-400 bg-green-400/10",
  edit: "text-yellow-400 bg-yellow-400/10",
  remove: "text-red-400 bg-red-400/10",
};

const statusStyles = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

export function LogDetailModal({
  open,
  onOpenChange,
  selectedLogId,
  selectedRunId,
}: LogDetailModalProps) {
  const [changes, setChanges] = useState<SellerChanges>({ added: [], removed: [] });
  const [allEntries, setAllEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [changesLoading, setChangesLoading] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<{ type: "log" | "run"; id: string } | null>(null);

  const supabase = createClient();

  // Fetch changes for a specific audit log entry
  const fetchChangesForEntry = useCallback(async (logId: string) => {
    setChangesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_BASE}/sellers/audit-log/${logId}/sellers`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // New response shape: { sellers, count, added, removed }
        setChanges({
          added: data.added || [],
          removed: data.removed || [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch changes:", e);
    } finally {
      setChangesLoading(false);
    }
  }, [supabase.auth]);

  // Fetch changes for a specific collection run
  const fetchChangesForRun = useCallback(async (runId: string) => {
    setChangesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${API_BASE}/sellers/export?run_id=${runId}&format=json`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Collection runs only add sellers, never remove
        setChanges({
          added: (data.sellers || []).map((s: { display_name: string }) => s.display_name),
          removed: [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch changes for run:", e);
    } finally {
      setChangesLoading(false);
    }
  }, [supabase.auth]);

  // Initial fetch when modal opens
  useEffect(() => {
    if (!open) return;
    if (!selectedLogId && !selectedRunId) return;

    // Set initial viewing entry
    if (selectedRunId) {
      setViewingEntry({ type: "run", id: selectedRunId });
    } else if (selectedLogId) {
      setViewingEntry({ type: "log", id: selectedLogId });
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch both logs and collection runs in parallel
        const [logsRes, runsRes] = await Promise.all([
          fetch(`${API_BASE}/sellers/audit-log?limit=100`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_BASE}/collection/runs/history?limit=50`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        const mergedEntries: HistoryEntry[] = [];

        // Process manual edit logs
        if (logsRes.ok) {
          const data = await logsRes.json();
          for (const log of data.entries || []) {
            mergedEntries.push({
              type: "manual_edit",
              id: log.id,
              action: log.action,
              seller_name: log.seller_name,
              source: log.source,
              affected_count: log.affected_count || 1,
              created_at: log.created_at,
            });
          }
        }

        // Process collection runs
        if (runsRes.ok) {
          const data = await runsRes.json();
          for (const run of data.runs || []) {
            mergedEntries.push({
              type: "collection_run",
              id: run.id,
              name: run.name,
              started_at: run.started_at,
              completed_at: run.completed_at,
              status: run.status,
              sellers_new: run.sellers_new || 0,
              categories_count: run.categories_count || 0,
            });
          }
        }

        // Sort by timestamp descending
        mergedEntries.sort((a, b) => {
          const aTime = a.type === "collection_run"
            ? (a.completed_at || a.started_at)
            : a.created_at;
          const bTime = b.type === "collection_run"
            ? (b.completed_at || b.started_at)
            : b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        setAllEntries(mergedEntries);

        // Fetch changes for initial selection
        if (selectedRunId) {
          await fetchChangesForRun(selectedRunId);
        } else if (selectedLogId) {
          await fetchChangesForEntry(selectedLogId);
        }
      } catch (e) {
        console.error("Failed to fetch log data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, selectedLogId, selectedRunId, supabase.auth, fetchChangesForEntry, fetchChangesForRun]);

  // Unified click handler for all entry types
  const handleEntryClick = (entry: HistoryEntry) => {
    if (entry.type === "manual_edit") {
      setViewingEntry({ type: "log", id: entry.id });
      fetchChangesForEntry(entry.id);
    } else if (entry.type === "collection_run") {
      setViewingEntry({ type: "run", id: entry.id });
      fetchChangesForRun(entry.id);
    }
  };

  const isViewing = (entry: HistoryEntry) => {
    if (!viewingEntry) return false;
    if (entry.type === "manual_edit" && viewingEntry.type === "log") {
      return entry.id === viewingEntry.id;
    }
    if (entry.type === "collection_run" && viewingEntry.type === "run") {
      return entry.id === viewingEntry.id;
    }
    return false;
  };

  // Get timestamp for an entry
  const getEntryTime = (entry: HistoryEntry): string => {
    if (entry.type === "collection_run") {
      return entry.completed_at || entry.started_at;
    }
    return entry.created_at;
  };

  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-3xl h-[80vh] flex flex-col" hideCloseButton>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground">
            History Entry
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground p-4">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left: Changes panel */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-foreground mb-2 flex-shrink-0">
                Changes
              </h4>
              <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted rounded border border-border p-2 min-h-0">
                {changesLoading ? (
                  <div className="text-muted-foreground text-sm">Loading changes...</div>
                ) : !hasChanges ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mb-2 text-muted-foreground/60" />
                    <span className="text-sm">No changes in this entry</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Added section - only if items exist */}
                    {changes.added.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">
                          Added ({changes.added.length})
                        </h4>
                        <div className="space-y-1">
                          {changes.added.map((name, i) => (
                            <div
                              key={`added-${name}-${i}`}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded",
                                "border-l-2 border-green-500",
                                i % 2 === 0 ? "bg-green-500/10" : "bg-green-500/5"
                              )}
                            >
                              <Plus className="h-3.5 w-3.5 text-green-400" />
                              <span className="text-sm text-green-300">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Removed section - only if items exist */}
                    {changes.removed.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">
                          Removed ({changes.removed.length})
                        </h4>
                        <div className="space-y-1">
                          {changes.removed.map((name, i) => (
                            <div
                              key={`removed-${name}-${i}`}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded",
                                "border-l-2 border-red-500",
                                i % 2 === 0 ? "bg-red-500/10" : "bg-red-500/5"
                              )}
                            >
                              <Minus className="h-3.5 w-3.5 text-red-400" />
                              <span className="text-sm text-red-300">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Full history */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-foreground mb-2 flex-shrink-0">
                Full History
              </h4>
              <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted rounded border border-border min-h-0">
                {allEntries.map((entry) => {
                  if (entry.type === "manual_edit") {
                    // Manual edit entry
                    return (
                      <button
                        key={`edit-${entry.id}`}
                        onClick={() => handleEntryClick(entry)}
                        className={cn(
                          "w-full text-left px-3 py-2 border-b border-border last:border-0",
                          "hover:bg-accent transition-colors",
                          isViewing(entry) && "bg-blue-500/20 ring-1 ring-blue-500/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={actionColors[entry.action]}>
                            {entry.action === "add" && <Plus className="h-3 w-3 mr-1" />}
                            {entry.action === "edit" && <Edit3 className="h-3 w-3 mr-1" />}
                            {entry.action === "remove" && <Minus className="h-3 w-3 mr-1" />}
                            {entry.action}
                          </Badge>
                          <span className="text-foreground text-sm truncate flex-1">
                            {entry.affected_count > 1
                              ? `${entry.affected_count} sellers`
                              : entry.seller_name}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1 font-mono">
                          {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                        </div>
                      </button>
                    );
                  } else {
                    // Collection run entry
                    return (
                      <button
                        key={`run-${entry.id}`}
                        onClick={() => handleEntryClick(entry)}
                        className={cn(
                          "w-full text-left px-3 py-2 border-b border-border last:border-0",
                          "hover:bg-accent transition-colors",
                          isViewing(entry) && "bg-blue-500/20 ring-1 ring-blue-500/50"
                        )}
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
                        <div className="flex items-center gap-2 mt-1">
                          {entry.sellers_new > 0 && (
                            <span className="text-green-400 text-xs">
                              +{entry.sellers_new}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs font-mono">
                            {format(new Date(getEntryTime(entry)), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                      </button>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
