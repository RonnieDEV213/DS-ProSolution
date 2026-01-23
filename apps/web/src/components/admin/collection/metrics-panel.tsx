"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  User,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ShoppingCart,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityEntry, WorkerMetrics, WorkerState, deriveWorkerState } from "./activity-feed";
import { PipelineFeed } from "./pipeline-feed";
import { MetricsSummary } from "./metrics-summary";

interface MetricsPanelProps {
  activities: ActivityEntry[];
  workerMetrics: Map<number, WorkerMetrics>;
  progress: {
    phase: "amazon" | "ebay";
    sellers_found: number;
    sellers_new: number;
    products_found: number;
  };
  expandedWorkerId: number | null;
  onExpandWorker: (workerId: number) => void;
}

// Mini worker status icons for awareness when viewing expanded worker
const workerColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
];

function MiniWorkerIcon({
  workerId,
  state,
  phase,
  isExpanded,
  onClick,
}: {
  workerId: number;
  state: WorkerState;
  phase?: "amazon" | "ebay";
  isExpanded: boolean;
  onClick: () => void;
}) {
  const colorIdx = (workerId - 1) % workerColors.length;

  const getStateIcon = () => {
    switch (state) {
      case "searching_products":
      case "searching_sellers":
        return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
      case "returning_products":
      case "returning_sellers":
        return <CheckCircle className="h-2.5 w-2.5" />;
      case "rate_limited":
        return <Clock className="h-2.5 w-2.5 text-yellow-400" />;
      case "error":
        return <AlertCircle className="h-2.5 w-2.5 text-red-400" />;
      case "complete":
        return <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />;
      default:
        return null;
    }
  };

  const getPhaseIcon = () => {
    if (!phase) return null;
    return phase === "amazon"
      ? <ShoppingCart className="h-2 w-2" />
      : <Search className="h-2 w-2" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "relative w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isExpanded ? "ring-2 ring-white" : "hover:ring-1 hover:ring-gray-500",
              state === "idle" ? "bg-gray-700" : workerColors[colorIdx]
            )}
          >
            <span className="text-[10px] font-bold text-white">W{workerId}</span>
            {/* State indicator */}
            {state !== "idle" && (
              <span className="absolute -bottom-0.5 -right-0.5 bg-gray-900 rounded-full p-0.5">
                {getStateIcon()}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex items-center gap-1.5">
            <span>Worker {workerId}</span>
            {phase && (
              <Badge className={cn(
                "text-[9px] px-1",
                phase === "amazon" ? "bg-orange-500/20" : "bg-blue-500/20"
              )}>
                {getPhaseIcon()}
              </Badge>
            )}
          </div>
          <div className="text-gray-400 capitalize">{state.replace(/_/g, " ")}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MetricsPanel({
  activities,
  workerMetrics,
  progress,
  expandedWorkerId,
  onExpandWorker,
}: MetricsPanelProps) {
  // Get last activity per worker for mini status
  const lastActivityByWorker = new Map<number, ActivityEntry>();
  for (const activity of activities) {
    if (activity.worker_id > 0 && !lastActivityByWorker.has(activity.worker_id)) {
      lastActivityByWorker.set(activity.worker_id, activity);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Mini worker status (shown when a worker is expanded) */}
      {expandedWorkerId !== null && (
        <div className="mb-4 pb-3 border-b border-gray-800">
          <div className="text-xs text-gray-500 uppercase mb-2">Other Workers</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6]
              .filter((id) => id !== expandedWorkerId)
              .map((workerId) => {
                const lastActivity = lastActivityByWorker.get(workerId);
                return (
                  <MiniWorkerIcon
                    key={workerId}
                    workerId={workerId}
                    state={deriveWorkerState(lastActivity)}
                    phase={lastActivity?.phase}
                    isExpanded={false}
                    onClick={() => onExpandWorker(workerId)}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Metrics Summary */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-300 mb-2">Metrics</div>
        <MetricsSummary
          workerMetrics={workerMetrics}
          sellersFound={progress.sellers_found}
          sellersNew={progress.sellers_new}
          productsFound={progress.products_found}
          phase={progress.phase}
        />
      </div>

      {/* Pipeline Feed */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="text-sm font-medium text-gray-300 mb-2 flex-shrink-0">Data Pipeline</div>
        <div className="flex-1 min-h-0">
          <PipelineFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
