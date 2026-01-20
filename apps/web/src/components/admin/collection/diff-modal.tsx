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
import { Download, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface DiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string | null; // null = current list
  targetId: string | null; // null = current list
}

interface DiffResult {
  added: string[];
  removed: string[];
  added_count: number;
  removed_count: number;
}

interface Seller {
  id: string;
  display_name: string;
}

export function DiffModal({ open, onOpenChange, sourceId, targetId }: DiffModalProps) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [sourceSellers, setSourceSellers] = useState<string[]>([]);
  const [targetSellers, setTargetSellers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!open) return;

    const fetchDiff = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch diff
        const diffRes = await fetch(`${API_BASE}/sellers/diff`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            source: sourceId ? "log" : "current",
            source_id: sourceId,
            target: targetId ? "log" : "current",
            target_id: targetId,
          }),
        });

        if (diffRes.ok) {
          const data = await diffRes.json();
          setDiff(data);
        }

        // Fetch source sellers
        if (sourceId) {
          const sourceRes = await fetch(
            `${API_BASE}/sellers/audit-log/${sourceId}/sellers`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (sourceRes.ok) {
            const data = await sourceRes.json();
            setSourceSellers(data.sellers || []);
          }
        } else {
          const sourceRes = await fetch(`${API_BASE}/sellers`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (sourceRes.ok) {
            const data = await sourceRes.json();
            setSourceSellers(data.sellers.map((s: Seller) => s.display_name) || []);
          }
        }

        // Fetch target sellers
        if (targetId) {
          const targetRes = await fetch(
            `${API_BASE}/sellers/audit-log/${targetId}/sellers`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (targetRes.ok) {
            const data = await targetRes.json();
            setTargetSellers(data.sellers || []);
          }
        } else {
          const targetRes = await fetch(`${API_BASE}/sellers`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (targetRes.ok) {
            const data = await targetRes.json();
            setTargetSellers(data.sellers.map((s: Seller) => s.display_name) || []);
          }
        }
      } catch (e) {
        console.error("Failed to fetch diff:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [open, sourceId, targetId, supabase.auth]);

  const copyList = async (type: "added" | "removed" | "source" | "target") => {
    let list: string[] = [];
    switch (type) {
      case "added":
        list = diff?.added || [];
        break;
      case "removed":
        list = diff?.removed || [];
        break;
      case "source":
        list = sourceSellers;
        break;
      case "target":
        list = targetSellers;
        break;
    }
    await navigator.clipboard.writeText(list.join("\n"));
    setCopySuccess(type);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const downloadCSV = (type: "added" | "removed", list: string[]) => {
    const content = "seller_name\n" + list.join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_sellers.csv`;
    a.click();
  };

  const downloadJSON = (type: "added" | "removed", list: string[]) => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_sellers.json`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-white">
            Seller Comparison
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-gray-400 p-4">Calculating diff...</div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400">
                +{diff?.added_count || 0} added
              </span>
              <span className="text-red-400">
                -{diff?.removed_count || 0} removed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 h-[50vh]">
              {/* Source list */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-300">
                    {sourceId ? "Source Snapshot" : "Current List"} ({sourceSellers.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyList("source")}
                  >
                    {copySuccess === "source" ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2">
                  {sourceSellers.map((name, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-sm py-0.5 truncate",
                        diff?.removed.includes(name)
                          ? "text-red-400 bg-red-900/20 px-1 rounded"
                          : "text-gray-300"
                      )}
                    >
                      {diff?.removed.includes(name) && "- "}
                      {name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Target list */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-300">
                    {targetId ? "Target Snapshot" : "Current List"} ({targetSellers.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyList("target")}
                  >
                    {copySuccess === "target" ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-2">
                  {targetSellers.map((name, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-sm py-0.5 truncate",
                        diff?.added.includes(name)
                          ? "text-green-400 bg-green-900/20 px-1 rounded"
                          : "text-gray-300"
                      )}
                    >
                      {diff?.added.includes(name) && "+ "}
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Added/Removed export sections */}
            <div className="grid grid-cols-2 gap-4">
              {/* Added sellers */}
              <div className="bg-green-900/10 border border-green-900/30 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-green-400">
                    Added ({diff?.added_count || 0})
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyList("added")}
                      className="text-green-400"
                    >
                      {copySuccess === "added" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadCSV("added", diff?.added || [])}
                      className="text-green-400"
                    >
                      CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadJSON("added", diff?.added || [])}
                      className="text-green-400"
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                <div className="max-h-24 overflow-y-auto text-sm text-green-300">
                  {diff?.added.slice(0, 10).join(", ")}
                  {(diff?.added.length || 0) > 10 && "..."}
                </div>
              </div>

              {/* Removed sellers */}
              <div className="bg-red-900/10 border border-red-900/30 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-red-400">
                    Removed ({diff?.removed_count || 0})
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyList("removed")}
                      className="text-red-400"
                    >
                      {copySuccess === "removed" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadCSV("removed", diff?.removed || [])}
                      className="text-red-400"
                    >
                      CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadJSON("removed", diff?.removed || [])}
                      className="text-red-400"
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                <div className="max-h-24 overflow-y-auto text-sm text-red-300">
                  {diff?.removed.slice(0, 10).join(", ")}
                  {(diff?.removed.length || 0) > 10 && "..."}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
