"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkerStatus {
  worker_id: number;
  department: string;
  category: string;
  product: string | null;
  status: "idle" | "fetching" | "searching" | "complete";
}

interface ProgressDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: {
    departments_total: number;
    departments_completed: number;
    categories_total: number;
    categories_completed: number;
    products_total: number;
    products_searched: number;
    sellers_found: number;
    sellers_new: number;
    actual_cost_cents: number;
    budget_cap_cents: number;
    cost_status: "safe" | "warning" | "exceeded";
    worker_status: WorkerStatus[];
  } | null;
  isMinimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
  onCancel: () => void;
}

const statusColors = {
  idle: "bg-gray-500/20 text-gray-400",
  fetching: "bg-yellow-500/20 text-yellow-400",
  searching: "bg-blue-500/20 text-blue-400",
  complete: "bg-green-500/20 text-green-400",
};

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProgressDetailModal({
  open,
  onOpenChange,
  progress,
  isMinimized,
  onMinimizeChange,
  onCancel,
}: ProgressDetailModalProps) {
  if (!progress) return null;

  const costColorClass = {
    safe: "text-green-400",
    warning: "text-yellow-400",
    exceeded: "text-red-400",
  }[progress.cost_status];

  // Minimized floating indicator
  if (isMinimized) {
    return (
      <div
        onClick={() => onMinimizeChange(false)}
        className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer shadow-lg z-50 min-w-[200px] hover:bg-gray-750"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Collection Running</span>
          <Badge className="bg-blue-500/20 text-blue-400 text-xs">
            {progress.products_total > 0
              ? Math.round((progress.products_searched / progress.products_total) * 100)
              : 0}%
          </Badge>
        </div>
        <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{
              width: `${(progress.products_searched / Math.max(1, progress.products_total)) * 100}%`,
            }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {progress.products_searched}/{progress.products_total} products
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">Collection Progress</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMinimizeChange(true)}
              className="text-gray-400 hover:text-white"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs uppercase">Cost</div>
              <div className={cn("text-xl font-bold", costColorClass)}>
                {formatCost(progress.actual_cost_cents)}
              </div>
              <div className="text-gray-500 text-sm">
                of {formatCost(progress.budget_cap_cents)}
              </div>
            </div>

            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs uppercase">Progress</div>
              <div className="text-xl font-bold text-white">
                {progress.products_total > 0
                  ? Math.round((progress.products_searched / progress.products_total) * 100)
                  : 0}%
              </div>
              <div className="text-gray-500 text-sm">
                {progress.products_searched}/{progress.products_total} products
              </div>
            </div>

            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs uppercase">New Sellers</div>
              <div className="text-xl font-bold text-green-400">
                +{progress.sellers_new}
              </div>
              <div className="text-gray-500 text-sm">
                {progress.sellers_found} total found
              </div>
            </div>
          </div>

          {/* Hierarchical progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Departments</span>
              <span className="text-gray-300">
                {progress.departments_completed}/{progress.departments_total}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{
                  width: `${(progress.departments_completed / Math.max(1, progress.departments_total)) * 100}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-sm mt-3">
              <span className="text-gray-400">Categories</span>
              <span className="text-gray-300">
                {progress.categories_completed}/{progress.categories_total}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{
                  width: `${(progress.categories_completed / Math.max(1, progress.categories_total)) * 100}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-sm mt-3">
              <span className="text-gray-400">Products</span>
              <span className="text-gray-300">
                {progress.products_searched}/{progress.products_total}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-500"
                style={{
                  width: `${(progress.products_searched / Math.max(1, progress.products_total)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Worker status */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Workers ({progress.worker_status.length} concurrent)
            </h4>
            <div className="space-y-2">
              {progress.worker_status.map((worker) => (
                <div
                  key={worker.worker_id}
                  className="bg-gray-800 rounded p-2 flex items-center gap-3"
                >
                  <Badge className={statusColors[worker.status]}>
                    #{worker.worker_id}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-300 truncate">
                      {worker.department} &rarr; {worker.category}
                    </div>
                    {worker.product && (
                      <div className="text-xs text-gray-500 truncate">
                        Searching: {worker.product}
                      </div>
                    )}
                  </div>
                  <Badge className={statusColors[worker.status]}>
                    {worker.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel button */}
          <div className="flex justify-end pt-4 border-t border-gray-800">
            <Button
              variant="destructive"
              onClick={onCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Collection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
