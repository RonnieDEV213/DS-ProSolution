"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface DiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string | null;
  targetId: string | null;
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

            <div className="grid grid-cols-2 gap-4 h-[60vh]">
              {/* Source list */}
              <div className="flex flex-col">
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  {sourceId ? "Source Snapshot" : "Current List"} ({sourceSellers.length})
                </h4>
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
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  {targetId ? "Target Snapshot" : "Current List"} ({targetSellers.length})
                </h4>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
