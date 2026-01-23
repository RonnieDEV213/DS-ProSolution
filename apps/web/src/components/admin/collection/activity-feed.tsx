"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  FolderOpen,
  Upload,
  Copy,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// Activity entry type from backend
export interface ActivityEntry {
  // Existing fields
  id: string;
  timestamp: string;
  worker_id: number;
  phase: "amazon" | "ebay";
  action:
    | "fetching"
    | "found"
    | "error"
    | "rate_limited"
    | "complete"
    // Pipeline actions
    | "uploading"
    | "deduped"
    | "inserted"
    | "updated"
    // SSE control
    | "connected";
  category?: string;
  product_name?: string;
  seller_found?: string;
  new_sellers_count?: number;
  error_message?: string;

  // NEW: Request details (for full transparency)
  url?: string;
  api_params?: {
    query?: string;
    amazon_price?: number;  // Amazon price in cents
    price_min?: number;     // eBay min price in cents (80% markup)
    price_max?: number;     // eBay max price in cents (120% markup)
    node_id?: string;
    page?: number;
  };

  // NEW: Timing
  duration_ms?: number;
  started_at?: string;

  // NEW: Retry context
  attempt?: number;

  // NEW: Error classification
  error_type?: string; // "rate_limit", "timeout", "http_500", "parse_error"
  error_stage?: string; // "api", "product_extraction", "seller_extraction", "price_parsing"

  // NEW: Pipeline context (for worker_id=0 system events)
  items_count?: number;
  source_worker_id?: number;
  operation_type?: string;
}

// Worker metrics for aggregated stats
export interface WorkerMetrics {
  worker_id: number;

  // API stats
  api_requests_total: number;
  api_requests_success: number;
  api_requests_failed: number;
  api_retries: number;
  total_duration_ms: number; // Sum for avg calculation

  // Output stats
  products_found: number; // Amazon phase
  sellers_found: number; // eBay phase
  sellers_new: number;

  // Error breakdown
  errors_by_type: Record<string, number>; // {rate_limit: 2, timeout: 1, parse_error: 3}

  // Last activity for summary line
  last_activity?: ActivityEntry;
}

// Worker state derived from last activity
export type WorkerState =
  | "idle"
  | "searching_products" // Amazon phase: fetching
  | "returning_products" // Amazon phase: found
  | "searching_sellers" // eBay phase: fetching
  | "returning_sellers" // eBay phase: found
  | "rate_limited"
  | "error"
  | "complete";

export function deriveWorkerState(
  entry: ActivityEntry | undefined
): WorkerState {
  if (!entry) return "idle";

  if (entry.action === "complete") return "complete";
  if (entry.action === "error") return "error";
  if (entry.action === "rate_limited") return "rate_limited";

  if (entry.phase === "amazon") {
    return entry.action === "fetching"
      ? "searching_products"
      : "returning_products";
  } else {
    return entry.action === "fetching"
      ? "searching_sellers"
      : "returning_sellers";
  }
}

interface ActivityFeedProps {
  activities: ActivityEntry[];
  maxEntries?: number;
}

// Worker colors for visual distinction
const workerColors = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-green-500/20 text-green-400 border-green-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
];

// Action icons
const actionIcons: Record<ActivityEntry["action"], React.ReactNode> = {
  // Existing
  fetching: <FolderOpen className="h-4 w-4" />,
  found: <CheckCircle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  rate_limited: <Clock className="h-4 w-4" />,
  complete: <CheckCircle className="h-4 w-4" />,
  // Pipeline
  uploading: <Upload className="h-4 w-4" />,
  deduped: <Copy className="h-4 w-4" />,
  inserted: <Plus className="h-4 w-4" />,
  updated: <RefreshCw className="h-4 w-4" />,
  // SSE control
  connected: <CheckCircle className="h-4 w-4" />,
};

// Action styles
const actionStyles: Record<ActivityEntry["action"], string> = {
  // Existing
  fetching: "border-l-blue-400",
  found: "border-l-green-400",
  error: "border-l-red-400",
  rate_limited: "border-l-yellow-400",
  complete: "border-l-emerald-400",
  // Pipeline
  uploading: "border-l-purple-400",
  deduped: "border-l-gray-400",
  inserted: "border-l-green-400",
  updated: "border-l-blue-400",
  // SSE control
  connected: "border-l-gray-400",
};

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const workerColor = entry.worker_id > 0
    ? workerColors[(entry.worker_id - 1) % workerColors.length]
    : "bg-gray-500/20 text-gray-400 border-gray-500/30";

  const isPhaseComplete = entry.action === "complete";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "p-3 rounded-lg bg-gray-800/50 border-l-4",
        actionStyles[entry.action],
        isPhaseComplete && "bg-gradient-to-r from-emerald-900/30 to-gray-800/50"
      )}
    >
      {/* Header row: Worker badge + Phase + Timestamp */}
      <div className="flex items-center gap-2 mb-2">
        {entry.worker_id > 0 && (
          <Badge className={cn("text-[10px] px-1.5 py-0", workerColor)}>
            <User className="h-2.5 w-2.5 mr-0.5" />
            W{entry.worker_id}
          </Badge>
        )}

        <Badge
          className={cn(
            "text-[10px] px-1.5 py-0",
            entry.phase === "amazon"
              ? "bg-orange-500/20 text-orange-400"
              : "bg-blue-500/20 text-blue-400"
          )}
        >
          {entry.phase === "amazon" ? (
            <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
          ) : (
            <Search className="h-2.5 w-2.5 mr-0.5" />
          )}
          {entry.phase === "amazon" ? "Amazon" : "eBay"}
        </Badge>

        <span className="text-[10px] text-gray-500 ml-auto">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </span>
      </div>

      {/* Content based on action type */}
      <div className="flex items-start gap-2">
        <div className={cn(
          "mt-0.5",
          entry.action === "error" ? "text-red-400" :
          entry.action === "rate_limited" ? "text-yellow-400" :
          entry.action === "found" ? "text-green-400" :
          entry.action === "complete" ? "text-emerald-400" :
          "text-gray-400"
        )}>
          {actionIcons[entry.action]}
        </div>

        <div className="flex-1 min-w-0">
          {/* Action text */}
          {entry.action === "fetching" && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-400">Fetching </span>
              {entry.category && (
                <span className="text-white font-medium">{entry.category}</span>
              )}
              {entry.product_name && (
                <>
                  <span className="text-gray-400"> - </span>
                  <span className="text-gray-300 truncate">{entry.product_name}</span>
                </>
              )}
            </div>
          )}

          {entry.action === "found" && (
            <div className="text-sm">
              <span className="text-green-400 font-medium">
                +{entry.new_sellers_count || 0}
              </span>
              <span className="text-gray-400">
                {entry.phase === "amazon" ? " products" : " sellers"}
              </span>
              {entry.category && (
                <span className="text-gray-500 text-xs ml-2">
                  in {entry.category}
                </span>
              )}
            </div>
          )}

          {entry.action === "error" && (
            <div className="text-sm text-red-300">
              {entry.error_message || "Unknown error"}
            </div>
          )}

          {entry.action === "rate_limited" && (
            <div className="text-sm text-yellow-300">
              Rate limited - waiting before retry...
            </div>
          )}

          {entry.action === "complete" && (
            <div className="text-sm text-emerald-300 font-medium">
              {entry.phase === "amazon" ? "Amazon phase complete!" : (
                <>
                  eBay search complete!
                  {entry.new_sellers_count !== undefined && (
                    <span className="text-green-400 ml-2">
                      +{entry.new_sellers_count} new sellers
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ActivityFeed({ activities, maxEntries = 50 }: ActivityFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new entries arrive (newest at top)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [activities.length]);

  // Limit entries to prevent memory issues
  const displayedActivities = activities.slice(0, maxEntries);

  if (displayedActivities.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Waiting for activity...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
    >
      <AnimatePresence mode="popLayout">
        {displayedActivities.map((entry) => (
          <ActivityCard key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  );
}
