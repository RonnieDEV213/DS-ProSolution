"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minimize2, ShoppingCart, Search, Clock } from "lucide-react";
import { ActivityEntry, WorkerMetrics } from "./activity-feed";
import { WorkerStatusPanel } from "./worker-status-panel";
import { WorkerDetailView } from "./worker-detail-view";
import { MetricsPanel } from "./metrics-panel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ProgressDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: {
    run_id?: string;
    phase: "amazon" | "ebay";
    departments_total: number;
    departments_completed: number;
    categories_total: number;
    categories_completed: number;
    products_found: number;
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

// Initialize empty metrics for a worker
function createEmptyMetrics(workerId: number): WorkerMetrics {
  return {
    worker_id: workerId,
    api_requests_total: 0,
    api_requests_success: 0,
    api_requests_failed: 0,
    api_retries: 0,
    total_duration_ms: 0,
    products_found: 0,
    sellers_found: 0,
    sellers_new: 0,
    errors_by_type: {},
    last_activity: undefined,
  };
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
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [expandedWorkerId, setExpandedWorkerId] = useState<number | null>(null);
  const [workerMetrics, setWorkerMetrics] = useState<Map<number, WorkerMetrics>>(
    () => new Map([1, 2, 3, 4, 5].map((id) => [id, createEmptyMetrics(id)]))
  );
  const supabase = createClient();

  // Stable run_id ref - only updates when we get a valid new run_id
  // This prevents SSE disconnection when progress briefly flickers to null
  const stableRunIdRef = useRef<string | null>(null);

  // Update stable run_id only when we have a valid new one
  useEffect(() => {
    if (progress?.run_id && progress.run_id !== stableRunIdRef.current) {
      // New run started - reset state and update ref
      stableRunIdRef.current = progress.run_id;
      setActivities([]);
      setWorkerMetrics(new Map([1, 2, 3, 4, 5].map((id) => [id, createEmptyMetrics(id)])));
      setExpandedWorkerId(null);
    }
  }, [progress?.run_id]);

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

  // Client-side metrics aggregation from activity events
  const updateMetrics = useCallback((activity: ActivityEntry) => {
    if (activity.worker_id <= 0) return; // Skip system events

    setWorkerMetrics((prev) => {
      const newMap = new Map(prev);
      const metrics = newMap.get(activity.worker_id) || createEmptyMetrics(activity.worker_id);

      // Update last activity
      metrics.last_activity = activity;

      // Count requests
      if (activity.action === "fetching") {
        metrics.api_requests_total += 1;
        if (activity.attempt && activity.attempt > 1) {
          metrics.api_retries += 1;
        }
      }

      // Track success/failure
      if (activity.action === "found") {
        metrics.api_requests_success += 1;
        if (activity.duration_ms) {
          metrics.total_duration_ms += activity.duration_ms;
        }
        // Track output
        if (activity.phase === "amazon") {
          metrics.products_found += activity.new_sellers_count || 0;
        } else {
          metrics.sellers_found += activity.new_sellers_count || 0;
        }
      }

      if (activity.action === "error") {
        metrics.api_requests_failed += 1;
        // Track error type
        const errorType = activity.error_type || "other";
        metrics.errors_by_type[errorType] = (metrics.errors_by_type[errorType] || 0) + 1;
      }

      if (activity.action === "rate_limited") {
        // Rate limited counts as a request attempt
        const rateType = "rate_limit";
        metrics.errors_by_type[rateType] = (metrics.errors_by_type[rateType] || 0) + 1;
      }

      newMap.set(activity.worker_id, metrics);
      return newMap;
    });
  }, []);

  // Clear stable run_id when modal closes intentionally
  useEffect(() => {
    if (!open) {
      stableRunIdRef.current = null;
    }
  }, [open]);

  // SSE activity stream subscription - uses stable run_id to prevent flicker
  useEffect(() => {
    // Get stable run_id (either from ref or current progress)
    const runId = stableRunIdRef.current || progress?.run_id;

    if (!open || !runId) {
      return;
    }

    let eventSource: EventSource | null = null;
    let mounted = true;

    const connectSSE = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !mounted) return;

        const url = `${API_BASE}/collection/runs/${runId}/activity?token=${session.access_token}`;
        eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          if (!mounted) return;
          try {
            const activity = JSON.parse(event.data) as ActivityEntry;
            if (activity.action === "connected") {
              console.log("SSE activity stream connected");
              return;
            }

            // Add to activities (newest first)
            setActivities((prev) => [activity, ...prev].slice(0, 100));

            // Update metrics
            updateMetrics(activity);
          } catch (e) {
            console.error("Failed to parse activity:", e);
          }
        };

        eventSource.onerror = () => {
          console.log("SSE connection error, auto-reconnecting...");
        };
      } catch (e) {
        console.error("Failed to connect SSE:", e);
      }
    };

    connectSSE();

    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [open, progress?.run_id, supabase.auth, updateMetrics]);

  if (!progress) return null;

  const phase = progress.phase || "amazon";

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

  // Calculate total metrics for detail view
  const totalMetrics = {
    total_requests: Array.from(workerMetrics.values()).reduce(
      (sum, m) => sum + m.api_requests_total, 0
    ),
    total_errors: Array.from(workerMetrics.values()).reduce(
      (sum, m) => sum + m.api_requests_failed, 0
    ),
    total_sellers: progress.sellers_found,
  };

  // Minimized floating indicator (unchanged from before)
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
      <DialogContent className="bg-gray-900 border-gray-800 max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-white">Collection Progress</DialogTitle>
              {/* Phase badge */}
              <Badge
                className={
                  phase === "amazon"
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-blue-500/20 text-blue-400"
                }
              >
                {phase === "amazon" ? (
                  <>
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Amazon: {progressPercent}%
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    eBay: {progressPercent}%
                  </>
                )}
              </Badge>
              {/* Duration */}
              {progress.started_at && duration && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {duration}
                </span>
              )}
            </div>
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

        {/* 2-Panel Layout */}
        <div className="grid grid-cols-[1fr_320px] gap-6 h-[calc(85vh-120px)]">
          {/* Left Panel: Workers */}
          <div className="overflow-hidden">
            {expandedWorkerId === null ? (
              <WorkerStatusPanel
                activities={activities}
                workerMetrics={workerMetrics}
                onExpandWorker={setExpandedWorkerId}
              />
            ) : (
              <WorkerDetailView
                workerId={expandedWorkerId}
                activities={activities}
                metrics={workerMetrics.get(expandedWorkerId)}
                totalMetrics={totalMetrics}
                onBack={() => setExpandedWorkerId(null)}
              />
            )}
          </div>

          {/* Right Panel: Metrics + Pipeline */}
          <div className="border-l border-gray-800 pl-6 overflow-hidden">
            <MetricsPanel
              activities={activities}
              workerMetrics={workerMetrics}
              progress={{
                phase,
                sellers_found: progress.sellers_found,
                sellers_new: progress.sellers_new,
                products_found: progress.products_found,
              }}
              expandedWorkerId={expandedWorkerId}
              onExpandWorker={setExpandedWorkerId}
            />
          </div>
        </div>

        {/* Footer: Cancel button */}
        <div className="flex justify-end pt-4 border-t border-gray-800">
          <Button
            variant="destructive"
            onClick={onCancel}
            className="bg-red-600 hover:bg-red-700"
          >
            Cancel Collection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
