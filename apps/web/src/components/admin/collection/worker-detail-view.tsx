"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, User, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityEntry, WorkerMetrics } from "./activity-feed";
import { formatDistanceToNow } from "date-fns";

interface WorkerDetailViewProps {
  workerId: number;
  activities: ActivityEntry[];
  metrics: WorkerMetrics | undefined;
  onBack: () => void;
}

// Worker colors
const workerBgColors = [
  "bg-blue-500/10",
  "bg-green-500/10",
  "bg-purple-500/10",
  "bg-orange-500/10",
  "bg-pink-500/10",
  "bg-cyan-500/10",
];

type FilterType = "all" | "fetching" | "found" | "error" | "rate_limited";

export function WorkerDetailView({
  workerId,
  activities,
  metrics,
  onBack,
}: WorkerDetailViewProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  // Filter activities for this worker
  const workerActivities = useMemo(() => {
    return activities
      .filter((a) => a.worker_id === workerId)
      .filter((a) => filter === "all" || a.action === filter);
  }, [activities, workerId, filter]);

  const colorIdx = (workerId - 1) % workerBgColors.length;

  // Calculate average response time (only from successful requests that have duration)
  const avgResponseTime =
    metrics && metrics.api_requests_success > 0
      ? Math.round(metrics.total_duration_ms / metrics.api_requests_success)
      : 0;

  // Calculate rate limited count from errors_by_type
  const rateLimitedCount = metrics?.errors_by_type["rate_limit"] || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Badge className={cn("text-sm", workerBgColors[colorIdx])}>
          <User className="h-3 w-3 mr-1" />
          Worker {workerId}
        </Badge>
      </div>

      {/* Worker metrics - grouped sections */}
      <div className="space-y-3 mb-4">
        {/* API Requests Section */}
        <div className={cn("p-3 rounded-lg", workerBgColors[colorIdx])}>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            API Requests
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Sent:</span>
              <span className="text-white font-medium">{metrics?.api_requests_total || 0}</span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Completed:</span>
              <span className="text-blue-400 font-medium">{metrics?.api_requests_success || 0}</span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Errors:</span>
              <span className="text-red-400 font-medium">{metrics?.api_requests_failed || 0}</span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Rate Limited:</span>
              <span className="text-yellow-400 font-medium">{rateLimitedCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span>Retries: {metrics?.api_retries || 0}</span>
            <span>Avg: {avgResponseTime}ms</span>
          </div>
        </div>

        {/* Results Section */}
        <div className="p-3 rounded-lg bg-gray-800/50">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Results Found
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Sellers:</span>
              <span className="text-green-400 font-medium text-lg">{metrics?.sellers_found || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Products:</span>
              <span className="text-orange-400 font-medium text-lg">{metrics?.products_found || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error breakdown (if any errors) */}
      {metrics && Object.keys(metrics.errors_by_type).length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800/30">
          <div className="flex items-center gap-2 text-xs text-red-400 uppercase mb-2">
            <AlertTriangle className="h-3 w-3" />
            Error Breakdown
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.errors_by_type).map(([type, count]) => (
              <Badge
                key={type}
                variant="outline"
                className="text-red-300 border-red-700"
              >
                {type}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filter dropdown */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Log
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
        >
          <SelectTrigger className="w-32 h-8 text-xs bg-gray-800 border-gray-700">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="fetching">Fetching</SelectItem>
            <SelectItem value="found">Found</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="rate_limited">Rate Limited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Scrollable log */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-2">
        <TooltipProvider>
          {workerActivities.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">
              No activity yet
            </div>
          ) : (
            workerActivities.map((entry) => (
              <Tooltip key={entry.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "p-2 rounded text-xs cursor-default",
                      entry.action === "error"
                        ? "bg-red-900/20"
                        : entry.action === "rate_limited"
                          ? "bg-yellow-900/20"
                          : entry.action === "found"
                            ? "bg-green-900/20"
                            : "bg-gray-800/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-medium",
                          entry.action === "error"
                            ? "text-red-400"
                            : entry.action === "rate_limited"
                              ? "text-yellow-400"
                              : entry.action === "found"
                                ? "text-green-400"
                                : "text-gray-300"
                        )}
                      >
                        {entry.action}
                      </span>
                      <span className="text-gray-500">
                        {formatDistanceToNow(new Date(entry.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="text-gray-400 truncate mt-1">
                      {entry.category || entry.product_name || ""}
                      {entry.duration_ms && (
                        <span className="ml-2 text-gray-500">
                          {entry.duration_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    {entry.url && (
                      <div>
                        <strong>URL:</strong> {entry.url}
                      </div>
                    )}
                    {entry.api_params && (
                      <div>
                        <strong>Params:</strong>{" "}
                        {JSON.stringify(entry.api_params)}
                      </div>
                    )}
                    {entry.error_message && (
                      <div className="text-red-300">
                        <strong>Error:</strong> {entry.error_message}
                      </div>
                    )}
                    {entry.error_type && (
                      <div>
                        <strong>Type:</strong> {entry.error_type} (
                        {entry.error_stage})
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
