"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Plus, Minus, Edit3, Check } from "lucide-react";
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
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<(string | null)[]>([null, null]);

  const supabase = createClient();

  useEffect(() => {
    if (!open || !selectedLogId) return;

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

  const handleLogSelect = (logId: string | null) => {
    if (!compareMode) return;

    if (compareSelection[0] === null) {
      setCompareSelection([logId, null]);
    } else if (compareSelection[1] === null) {
      setCompareSelection([compareSelection[0], logId]);
    } else {
      // Reset and start over
      setCompareSelection([logId, null]);
    }
  };

  const startCompare = () => {
    if (compareSelection[0] !== null || compareSelection[1] !== null) {
      onCompare(compareSelection[0], compareSelection[1]);
    }
  };

  const isSelected = (logId: string | null) =>
    compareSelection[0] === logId || compareSelection[1] === logId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <span>Log Details</span>
            <div className="flex items-center gap-2">
              {compareMode ? (
                <>
                  <span className="text-sm text-gray-400">
                    Select 2 logs to compare (or &quot;Current&quot; for live list)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCompareMode(false);
                      setCompareSelection([null, null]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={startCompare}
                    disabled={compareSelection[0] === null && compareSelection[1] === null}
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
                  onClick={() => setCompareMode(true)}
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
          <div className="grid grid-cols-2 gap-4 h-[60vh]">
            {/* Left: Sellers at this log point */}
            <div className="flex flex-col">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Sellers at this point ({sellers.length})
              </h4>
              <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2">
                {sellers.length === 0 ? (
                  <div className="text-gray-500 text-sm">No sellers at this point</div>
                ) : (
                  <div className="space-y-1">
                    {sellers.map((name, i) => (
                      <div key={i} className="text-sm text-gray-300 truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Full history */}
            <div className="flex flex-col">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Full History
              </h4>
              <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700">
                {/* Current list option for compare */}
                {compareMode && (
                  <button
                    onClick={() => handleLogSelect(null)}
                    className={cn(
                      "w-full text-left px-3 py-2 border-b border-gray-700",
                      "hover:bg-gray-700 transition-colors",
                      isSelected(null) && "bg-blue-900/50 ring-1 ring-blue-500"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400">Current</Badge>
                      <span className="text-gray-300 text-sm">Live seller list</span>
                      {isSelected(null) && <Check className="h-4 w-4 text-blue-400 ml-auto" />}
                    </div>
                  </button>
                )}

                {allLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => compareMode && handleLogSelect(log.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 border-b border-gray-700 last:border-0",
                      "hover:bg-gray-700 transition-colors",
                      log.id === selectedLogId && "bg-gray-700",
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
