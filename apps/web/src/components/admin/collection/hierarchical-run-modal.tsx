"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Play,
  ChevronDown,
  Calendar,
  Clock,
  FolderTree,
  Package,
  Users,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface RunDetails {
  id: string;
  name: string;
  status: "completed" | "failed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  categories_count: number;
  category_ids: string[];
  products_total: number;
  products_searched: number;
  sellers_found: number;
  sellers_new: number;
}

interface Seller {
  display_name: string;
  ebay_seller_id: string;
  feedback_percent?: number;
  feedback_count?: number;
}

interface HierarchicalRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string | null;
  onRerun?: (categoryIds: string[]) => void;
}

const statusStyles = {
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-yellow-500/20 text-yellow-400",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function HierarchicalRunModal({
  open,
  onOpenChange,
  runId,
  onRerun,
}: HierarchicalRunModalProps) {
  const [runDetails, setRunDetails] = useState<RunDetails | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellersLoading, setSellersLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!open || !runId) {
      setRunDetails(null);
      setSellers([]);
      setLoading(true);
      setSellersLoading(true);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setSellersLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch run details and sellers in parallel
        const [runResponse, sellersResponse] = await Promise.all([
          fetch(`${API_BASE}/collection/runs/history?limit=50`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_BASE}/sellers/export?run_id=${runId}&format=json`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        // Process run details - find the specific run in history
        if (runResponse.ok) {
          const data = await runResponse.json();
          const run = (data.runs || []).find((r: RunDetails) => r.id === runId);
          if (run) {
            setRunDetails(run);
          }
        }
        setLoading(false);

        // Process sellers
        if (sellersResponse.ok) {
          const sellersData = await sellersResponse.json();
          setSellers(sellersData || []);
        }
        setSellersLoading(false);
      } catch (e) {
        console.error("Failed to fetch run details:", e);
        setLoading(false);
        setSellersLoading(false);
      }
    };

    fetchData();
  }, [open, runId, supabase.auth]);

  const handleExport = async (format: "csv" | "json") => {
    if (!runId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(
      `${API_BASE}/sellers/export?format=${format}&run_id=${runId}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellers_run-${runId.slice(0, 8)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRerun = () => {
    if (runDetails?.category_ids && onRerun) {
      onRerun(runDetails.category_ids);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl h-[80vh] flex flex-col" hideCloseButton>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white flex items-center gap-3">
            <span className="truncate">{runDetails?.name || "Run Details"}</span>
            {runDetails && (
              <Badge className={cn("text-xs", statusStyles[runDetails.status])}>
                {runDetails.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-400">Loading run details...</div>
          </div>
        ) : !runDetails ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500">Run not found</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Summary stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-800/50 rounded-lg mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Date</div>
                  <div className="text-sm text-gray-200">
                    {runDetails.completed_at
                      ? format(new Date(runDetails.completed_at), "MMM d, yyyy")
                      : "-"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="text-sm text-gray-200">
                    {formatDuration(runDetails.duration_seconds)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Categories</div>
                  <div className="text-sm text-gray-200">
                    {runDetails.categories_count}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Products</div>
                  <div className="text-sm text-gray-200">
                    {runDetails.products_searched}/{runDetails.products_total}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Sellers</div>
                  <div className="text-sm">
                    <span className="text-gray-200">{runDetails.sellers_found}</span>
                    {runDetails.sellers_new > 0 && (
                      <span className="text-green-400 ml-1">
                        (+{runDetails.sellers_new} new)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sellers grid */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h4 className="text-sm font-medium text-gray-300">
                  Sellers from this run ({sellers.length})
                </h4>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-800 rounded border border-gray-700 p-3 min-h-0">
                {sellersLoading ? (
                  <div className="text-gray-500 text-sm">Loading sellers...</div>
                ) : sellers.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8">
                    No sellers found in this run
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sellers.map((seller, i) => (
                      <div
                        key={seller.ebay_seller_id || i}
                        className="px-3 py-2 bg-gray-700 rounded text-sm text-gray-300 truncate"
                        title={seller.display_name}
                      >
                        {seller.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Future hierarchy placeholder */}
              <div className="mt-3 p-3 bg-gray-800/30 rounded border border-gray-700/50 text-center flex-shrink-0">
                <p className="text-xs text-gray-500">
                  Detailed category breakdown coming soon
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 flex items-center gap-2 pt-4 border-t border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
              <DropdownMenuItem
                onClick={() => handleExport("csv")}
                className="text-gray-200 focus:bg-gray-700"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("json")}
                className="text-gray-200 focus:bg-gray-700"
              >
                <FileJson className="h-4 w-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onRerun && runDetails?.category_ids && runDetails.category_ids.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRerun}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Play className="h-4 w-4" />
              Re-run
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
