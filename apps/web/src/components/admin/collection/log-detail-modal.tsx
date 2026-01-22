"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Plus, Minus, Edit3, Check, Download, FileText, Braces, ChevronDown, Bot, ExternalLink } from "lucide-react";
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

// Seller type for display
interface Seller {
  display_name: string;
  platform?: string;
  feedback_score?: number;
  times_seen?: number;
  discovered_at?: string;
}

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogId: string | null;
  selectedRunId?: string | null;
  onCompare: (sourceId: string | null, targetId: string | null) => void;
  onCollectionRunDetail?: (runId: string) => void;
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
  onCompare,
  onCollectionRunDetail,
}: LogDetailModalProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [allEntries, setAllEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [viewingEntry, setViewingEntry] = useState<{ type: "log" | "run"; id: string } | null>(null);

  const supabase = createClient();

  // Fetch sellers for a specific audit log entry
  const fetchSellersForLog = useCallback(async (logId: string) => {
    setSellersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sellersRes = await fetch(
        `${API_BASE}/sellers/audit-log/${logId}/sellers`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (sellersRes.ok) {
        const data = await sellersRes.json();
        // Convert string array to Seller objects for consistency
        const sellerObjects: Seller[] = (data.sellers || []).map((name: string) => ({
          display_name: name,
        }));
        setSellers(sellerObjects);
      }
    } catch (e) {
      console.error("Failed to fetch sellers:", e);
    } finally {
      setSellersLoading(false);
    }
  }, [supabase.auth]);

  // Fetch sellers for a specific collection run
  const fetchSellersForRun = useCallback(async (runId: string) => {
    setSellersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sellersRes = await fetch(
        `${API_BASE}/sellers/export?run_id=${runId}&format=json`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (sellersRes.ok) {
        const data = await sellersRes.json();
        setSellers(data.sellers || []);
      }
    } catch (e) {
      console.error("Failed to fetch sellers for run:", e);
    } finally {
      setSellersLoading(false);
    }
  }, [supabase.auth]);

  // Reset compare mode when modal opens
  useEffect(() => {
    if (open) {
      setCompareMode(false);
      setCompareSelection(new Set());
    }
  }, [open]);

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

        // Fetch sellers for initial selection
        if (selectedRunId) {
          await fetchSellersForRun(selectedRunId);
        } else if (selectedLogId) {
          await fetchSellersForLog(selectedLogId);
        }
      } catch (e) {
        console.error("Failed to fetch log data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, selectedLogId, selectedRunId, supabase.auth, fetchSellersForLog, fetchSellersForRun]);

  // Handle clicking an entry in normal mode
  const handleEntryClick = (entry: HistoryEntry) => {
    if (compareMode && entry.type === "manual_edit") {
      toggleLogSelection(entry.id);
    } else if (entry.type === "manual_edit") {
      setViewingEntry({ type: "log", id: entry.id });
      fetchSellersForLog(entry.id);
    } else if (entry.type === "collection_run") {
      setViewingEntry({ type: "run", id: entry.id });
      fetchSellersForRun(entry.id);
    }
  };

  // Toggle selection like a checkbox (only for manual edits)
  const toggleLogSelection = (logId: string) => {
    setCompareSelection((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else if (newSet.size < 2) {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Enter compare mode and pre-select 2 most recent manual edit logs
  const enterCompareMode = () => {
    const manualLogs = allEntries.filter((e) => e.type === "manual_edit");
    const preselected = new Set<string>();
    if (manualLogs.length >= 1) preselected.add(manualLogs[0].id);
    if (manualLogs.length >= 2) preselected.add(manualLogs[1].id);
    setCompareSelection(preselected);
    setCompareMode(true);
  };

  const startCompare = () => {
    const selected = Array.from(compareSelection);
    if (selected.length === 2) {
      onCompare(selected[0], selected[1]);
    }
  };

  const isSelected = (logId: string) => compareSelection.has(logId);

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

  // Get manual edit count for compare button
  const manualEditCount = allEntries.filter((e) => e.type === "manual_edit").length;

  // Export functions
  const downloadCSV = () => {
    const content = "seller_name\n" + sellers.map((s) => s.display_name).join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sellers_snapshot.csv";
    a.click();
  };

  const copyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(sellers, null, 2));
  };

  const copyRawText = async () => {
    await navigator.clipboard.writeText(sellers.map((s) => s.display_name).join("\n"));
  };

  // Get timestamp for an entry
  const getEntryTime = (entry: HistoryEntry): string => {
    if (entry.type === "collection_run") {
      return entry.completed_at || entry.started_at;
    }
    return entry.created_at;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl h-[80vh] flex flex-col" hideCloseButton>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white flex items-center justify-between">
            <span>Log Details</span>
            <div className="flex items-center gap-2">
              {compareMode ? (
                <>
                  <span className="text-sm text-gray-400">
                    Select 2 logs to compare ({compareSelection.size}/2)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCompareMode(false);
                      setCompareSelection(new Set());
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={startCompare}
                    disabled={compareSelection.size !== 2}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <GitCompare className="h-4 w-4 mr-1" />
                    Compare
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={enterCompareMode}
                  disabled={manualEditCount < 2}
                >
                  <GitCompare className="h-4 w-4 mr-1" />
                  Compare
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-gray-400 p-4">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left: Sellers at this log point */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h4 className="text-sm font-medium text-gray-300">
                  Sellers at this point ({sellers.length})
                </h4>
                {sellers.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        Export
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                      <DropdownMenuItem onClick={downloadCSV} className="text-gray-200 focus:bg-gray-700">
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyJSON} className="text-gray-200 focus:bg-gray-700">
                        <Braces className="h-4 w-4 mr-2" />
                        Copy JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyRawText} className="text-gray-200 focus:bg-gray-700">
                        <FileText className="h-4 w-4 mr-2" />
                        Copy Raw Text
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2 min-h-0">
                {sellersLoading ? (
                  <div className="text-gray-500 text-sm">Loading sellers...</div>
                ) : sellers.length === 0 ? (
                  <div className="text-gray-500 text-sm">No sellers at this point</div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-1">
                    {sellers.map((seller, i) => (
                      <div
                        key={i}
                        className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 truncate"
                        title={seller.display_name}
                      >
                        <span className="text-gray-500 mr-1">{i + 1}.</span>
                        {seller.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Full history */}
            <div className="flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex-shrink-0">
                Full History
              </h4>
              <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 min-h-0">
                {allEntries.map((entry) => {
                  if (entry.type === "manual_edit") {
                    // Manual edit entry
                    return (
                      <button
                        key={`edit-${entry.id}`}
                        onClick={() => handleEntryClick(entry)}
                        className={cn(
                          "w-full text-left px-3 py-2 border-b border-gray-700 last:border-0",
                          "hover:bg-gray-700 transition-colors",
                          !compareMode && isViewing(entry) && "bg-gray-700",
                          compareMode && isSelected(entry.id) && "bg-blue-900/50 ring-1 ring-blue-500"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={actionColors[entry.action]}>
                            {entry.action === "add" && <Plus className="h-3 w-3 mr-1" />}
                            {entry.action === "edit" && <Edit3 className="h-3 w-3 mr-1" />}
                            {entry.action === "remove" && <Minus className="h-3 w-3 mr-1" />}
                            {entry.action}
                          </Badge>
                          <span className="text-gray-300 text-sm truncate flex-1">
                            {entry.affected_count > 1
                              ? `${entry.affected_count} sellers`
                              : entry.seller_name}
                          </span>
                          {compareMode && isSelected(entry.id) && (
                            <Check className="h-4 w-4 text-blue-400" />
                          )}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                        </div>
                      </button>
                    );
                  } else {
                    // Collection run entry with "more detail" tab
                    return (
                      <div
                        key={`run-${entry.id}`}
                        className={cn(
                          "relative border-b border-gray-700 last:border-0",
                          !compareMode && isViewing(entry) && "bg-gray-700"
                        )}
                      >
                        <button
                          onClick={() => handleEntryClick(entry)}
                          className={cn(
                            "w-full text-left px-3 py-2 pr-10",
                            "hover:bg-gray-700/50 transition-colors"
                          )}
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
                          <div className="flex items-center gap-2 mt-1">
                            {entry.sellers_new > 0 && (
                              <span className="text-green-400 text-xs">
                                +{entry.sellers_new}
                              </span>
                            )}
                            <span className="text-gray-500 text-xs">
                              {format(new Date(getEntryTime(entry)), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                        </button>
                        {/* More detail tab on right side */}
                        {onCollectionRunDetail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCollectionRunDetail(entry.id);
                            }}
                            className={cn(
                              "absolute right-0 top-0 bottom-0 w-8",
                              "bg-blue-500/10 hover:bg-blue-500/20 transition-colors",
                              "flex items-center justify-center",
                              "border-l border-blue-500/30"
                            )}
                            title="View full details"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                          </button>
                        )}
                      </div>
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
