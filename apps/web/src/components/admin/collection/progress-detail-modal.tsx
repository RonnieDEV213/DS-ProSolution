"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minimize2, ShoppingCart, Search, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProgressDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: {
    phase: "amazon" | "ebay";
    departments_total: number;
    departments_completed: number;
    categories_total: number;
    categories_completed: number;
    products_found: number;  // Amazon phase
    products_total: number;
    products_searched: number;
    sellers_found: number;
    sellers_new: number;
    started_at?: string;
  } | null;
  isMinimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
  onCancel: () => void;
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function ProgressDetailModal({
  open,
  onOpenChange,
  progress,
  isMinimized,
  onMinimizeChange,
  onCancel,
}: ProgressDetailModalProps) {
  const [duration, setDuration] = useState<string>("");

  // Update duration timer every second
  useEffect(() => {
    if (!progress?.started_at) {
      setDuration("");
      return;
    }

    setDuration(formatDuration(progress.started_at));
    const interval = setInterval(() => {
      setDuration(formatDuration(progress.started_at!));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress?.started_at]);

  if (!progress) return null;

  // Default phase to "amazon" for backwards compatibility
  const phase = progress.phase || "amazon";

  // Calculate phase-appropriate progress percentage
  const getProgressPercent = () => {
    if (phase === "amazon") {
      return progress.categories_total > 0
        ? Math.round((progress.categories_completed / progress.categories_total) * 100)
        : 0;
    } else {
      return progress.products_total > 0
        ? Math.round((progress.products_searched / progress.products_total) * 100)
        : 0;
    }
  };

  const progressPercent = getProgressPercent();

  // Minimized floating indicator
  if (isMinimized) {
    return (
      <div
        onClick={() => onMinimizeChange(false)}
        className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer shadow-lg z-50 min-w-[200px] hover:bg-gray-750"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Collection Running</span>
          <Badge
            className={`text-xs ${
              phase === "amazon"
                ? "bg-orange-500/20 text-orange-400"
                : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {phase === "amazon" ? "Amazon" : "eBay"}: {progressPercent}%
          </Badge>
        </div>
        <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${
              phase === "amazon" ? "bg-orange-500" : "bg-blue-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {phase === "amazon"
            ? `${progress.categories_completed}/${progress.categories_total} categories`
            : `${progress.products_searched}/${progress.products_total} products`}
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
          <div className="grid grid-cols-2 gap-4">
            {/* Phase indicator card */}
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 text-xs uppercase mb-1">Current Phase</div>
              <div className="flex items-center gap-2">
                {phase === "amazon" ? (
                  <>
                    <ShoppingCart className="h-5 w-5 text-orange-400" />
                    <div>
                      <div className="text-lg font-bold text-white">Step 1: Collecting</div>
                      <div className="text-sm text-orange-400">{progressPercent}% complete</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 text-blue-400" />
                    <div>
                      <div className="text-lg font-bold text-white">Step 2: Searching</div>
                      <div className="text-sm text-blue-400">{progressPercent}% complete</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* New Sellers card */}
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

          {/* Duration display */}
          {progress.started_at && (
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 rounded px-3 py-2">
              <Clock className="h-4 w-4" />
              <span>
                Started {formatDistanceToNow(new Date(progress.started_at), { addSuffix: true })}
                {duration && <span className="ml-2 text-gray-500">({duration})</span>}
              </span>
            </div>
          )}

          {/* Hierarchical progress */}
          <div className="space-y-2">
            {/* Departments */}
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

            {/* Categories */}
            <div className="flex justify-between text-sm mt-3">
              <span className="text-gray-400">Categories</span>
              <span className="text-gray-300">
                {progress.categories_completed}/{progress.categories_total}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full ${phase === "amazon" ? "bg-orange-500" : "bg-blue-500"}`}
                style={{
                  width: `${(progress.categories_completed / Math.max(1, progress.categories_total)) * 100}%`,
                }}
              />
            </div>

            {/* Products - only shown in eBay phase */}
            {phase === "ebay" && (
              <>
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
              </>
            )}

            {/* Products found - only shown in Amazon phase */}
            {phase === "amazon" && (
              <div className="mt-4 p-3 bg-gray-800/50 rounded">
                <div className="text-sm text-gray-400">Products discovered so far</div>
                <div className="text-2xl font-bold text-orange-400">
                  {progress.products_found || 0}
                </div>
              </div>
            )}
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
