"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Search,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
  User,
} from "lucide-react";
import {
  ActivityEntry,
  WorkerState,
  deriveWorkerState,
} from "./activity-feed";

interface WorkerCardProps {
  worker_id: number;
  lastActivity?: ActivityEntry;
  onClick: () => void;
}

// Worker colors for visual distinction (same as activity-feed.tsx)
const workerColors = [
  "border-blue-500/50 hover:border-blue-500",
  "border-green-500/50 hover:border-green-500",
  "border-purple-500/50 hover:border-purple-500",
  "border-orange-500/50 hover:border-orange-500",
  "border-pink-500/50 hover:border-pink-500",
];

const workerBgColors = [
  "bg-blue-500/10",
  "bg-green-500/10",
  "bg-purple-500/10",
  "bg-orange-500/10",
  "bg-pink-500/10",
];

function StateIcon({ state }: { state: WorkerState }) {
  switch (state) {
    case "searching_products":
    case "searching_sellers":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "returning_products":
    case "returning_sellers":
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case "rate_limited":
      return <Clock className="h-4 w-4 text-yellow-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "complete":
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    default:
      return <User className="h-4 w-4 text-gray-500" />;
  }
}

function stateLabel(state: WorkerState): string {
  switch (state) {
    case "searching_products":
      return "Searching products...";
    case "returning_products":
      return "Products found";
    case "searching_sellers":
      return "Searching sellers...";
    case "returning_sellers":
      return "Sellers found";
    case "rate_limited":
      return "Rate limited";
    case "error":
      return "Error";
    case "complete":
      return "Complete";
    default:
      return "Idle";
  }
}

function formatLastActivity(entry: ActivityEntry): string {
  if (entry.action === "found") {
    const count = entry.new_sellers_count || 0;
    return entry.phase === "amazon"
      ? `Found ${count} products`
      : `Found ${count} sellers`;
  }
  if (entry.action === "error") {
    return `Error: ${entry.error_message?.slice(0, 30) || "Unknown"}`;
  }
  if (entry.action === "rate_limited") {
    return "Rate limited - waiting...";
  }
  if (entry.action === "fetching") {
    return `Fetching ${entry.category || entry.product_name || "..."}`;
  }
  if (entry.action === "complete") {
    return entry.phase === "amazon" ? "Amazon phase done" : "eBay phase done";
  }
  return "";
}

export function WorkerCard({
  worker_id,
  lastActivity,
  onClick,
}: WorkerCardProps) {
  const state = deriveWorkerState(lastActivity);
  const isIdle = state === "idle";
  const colorIdx = (worker_id - 1) % workerColors.length;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border-2 cursor-pointer transition-all",
        workerColors[colorIdx],
        isIdle ? "bg-gray-800/30" : workerBgColors[colorIdx],
        "hover:bg-gray-800/50"
      )}
    >
      {/* Header: Worker badge + Phase */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className="text-xs bg-gray-700 text-gray-300">
            W{worker_id}
          </Badge>
          {lastActivity && (
            <Badge
              className={cn(
                "text-[10px]",
                lastActivity.phase === "amazon"
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {lastActivity.phase === "amazon" ? (
                <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <Search className="h-2.5 w-2.5 mr-0.5" />
              )}
              {lastActivity.phase === "amazon" ? "Amazon" : "eBay"}
            </Badge>
          )}
        </div>
        <StateIcon state={state} />
      </div>

      {/* State label */}
      <div
        className={cn(
          "text-sm font-medium mb-1",
          isIdle ? "text-gray-500" : "text-white"
        )}
      >
        {stateLabel(state)}
      </div>

      {/* Request details (when active) */}
      {lastActivity?.api_params && !isIdle && (
        <div className="text-[10px] text-gray-500 mb-1 truncate">
          {lastActivity.api_params.query && (
            <span>
              Query: {lastActivity.api_params.query.slice(0, 25)}
              {lastActivity.api_params.query.length > 25 ? "..." : ""}
            </span>
          )}
          {lastActivity.api_params.node_id && (
            <span>Node: {lastActivity.api_params.node_id}</span>
          )}
          {lastActivity.api_params.page && (
            <span className="ml-2">Page {lastActivity.api_params.page}</span>
          )}
        </div>
      )}

      {/* Duration (when available) */}
      {lastActivity?.duration_ms && (
        <div className="text-[10px] text-gray-500 mb-1">
          {lastActivity.duration_ms}ms
        </div>
      )}

      {/* Last activity summary line */}
      {lastActivity && (
        <div
          className={cn(
            "text-xs mt-2 pt-2 border-t border-gray-700/50 truncate",
            state === "error" ? "text-red-400" : "text-gray-400"
          )}
        >
          {formatLastActivity(lastActivity)}
        </div>
      )}
    </div>
  );
}
