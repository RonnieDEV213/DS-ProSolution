"use client";

import { useState, useEffect } from "react";
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
import { GitCompare, Plus, Minus, Edit3, Check, Download, FileText, Braces, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface LogEntry {
  id: string;
  action: "add" | "edit" | "remove";
  seller_name: string;
  source: string;
  affected_count: number;
  created_at: string;
}

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLogId: string | null;
  onCompare: (sourceId: string | null, targetId: string | null) => void;
}

const actionColors = {
  add: "text-green-400 bg-green-400/10",
  edit: "text-yellow-400 bg-yellow-400/10",
  remove: "text-red-400 bg-red-400/10",
};

export function LogDetailModal({
  open,
  onOpenChange,
  selectedLogId,
  onCompare,
}: LogDetailModalProps) {
  const [sellers, setSellers] = useState<string[]>([]);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [viewingLogId, setViewingLogId] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch sellers for a specific log
  const fetchSellersForLog = async (logId: string) => {
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
        setSellers(data.sellers || []);
      }
    } catch (e) {
      console.error("Failed to fetch sellers:", e);
    } finally {
      setSellersLoading(false);
    }
  };

  // Reset compare mode when modal opens
  useEffect(() => {
    if (open) {
      setCompareMode(false);
      setCompareSelection(new Set());
    }
  }, [open]);

  // Initial fetch when modal opens
  useEffect(() => {
    if (!open || !selectedLogId) return;

    setViewingLogId(selectedLogId);

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch sellers at this log point
        const sellersRes = await fetch(
          `${API_BASE}/sellers/audit-log/${selectedLogId}/sellers`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (sellersRes.ok) {
          const data = await sellersRes.json();
          setSellers(data.sellers || []);
        }

        // Fetch all logs
        const logsRes = await fetch(
          `${API_BASE}/sellers/audit-log?limit=100`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (logsRes.ok) {
          const data = await logsRes.json();
          setAllLogs(data.entries || []);
        }
      } catch (e) {
        console.error("Failed to fetch log data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, selectedLogId, supabase.auth]);

  // Handle clicking a log entry in normal mode
  const handleLogClick = (logId: string) => {
    if (compareMode) {
      toggleLogSelection(logId);
    } else {
      setViewingLogId(logId);
      fetchSellersForLog(logId);
    }
  };

  // Toggle selection like a checkbox
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

  // Enter compare mode and pre-select 2 most recent logs
  const enterCompareMode = () => {
    const preselected = new Set<string>();
    if (allLogs.length >= 1) preselected.add(allLogs[0].id);
    if (allLogs.length >= 2) preselected.add(allLogs[1].id);
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

  // Export functions
  const downloadCSV = () => {
    const content = "seller_name\n" + sellers.join("\n");
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
    await navigator.clipboard.writeText(sellers.join("\n"));
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
                  disabled={allLogs.length < 2}
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
                    {sellers.map((name, i) => (
                      <div
                        key={i}
                        className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 truncate"
                      >
                        <span className="text-gray-500 mr-1">{i + 1}.</span>
                        {name}
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
                {allLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => handleLogClick(log.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 border-b border-gray-700 last:border-0",
                      "hover:bg-gray-700 transition-colors",
                      !compareMode && log.id === viewingLogId && "bg-gray-700",
                      compareMode && isSelected(log.id) && "bg-blue-900/50 ring-1 ring-blue-500"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={actionColors[log.action]}>
                        {log.action === "add" && <Plus className="h-3 w-3 mr-1" />}
                        {log.action === "edit" && <Edit3 className="h-3 w-3 mr-1" />}
                        {log.action === "remove" && <Minus className="h-3 w-3 mr-1" />}
                        {log.action}
                      </Badge>
                      <span className="text-gray-300 text-sm truncate flex-1">
                        {log.affected_count > 1
                          ? `${log.affected_count} sellers`
                          : log.seller_name}
                      </span>
                      {compareMode && isSelected(log.id) && (
                        <Check className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
