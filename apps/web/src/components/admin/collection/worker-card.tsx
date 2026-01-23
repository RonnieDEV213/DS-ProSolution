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
  DollarSign,
  Package,
  Truck,
  Globe,
  ExternalLink,
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

// Worker colors for visual distinction
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
      return "Fetching products...";
    case "returning_products":
      return "Products found";
    case "searching_sellers":
      return "Searching eBay...";
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

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  // Show domain + truncated path
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    const truncatedPath = path.length > 30 ? path.slice(0, 30) + "..." : path;
    return parsed.hostname + truncatedPath;
  } catch {
    return url.slice(0, maxLen) + "...";
  }
}

export function WorkerCard({
  worker_id,
  lastActivity,
  onClick,
}: WorkerCardProps) {
  const state = deriveWorkerState(lastActivity);
  const isIdle = state === "idle";
  const colorIdx = (worker_id - 1) % workerColors.length;
  const params = lastActivity?.api_params;
  const isEbay = lastActivity?.phase === "ebay";
  const isAmazon = lastActivity?.phase === "amazon";

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
      {/* Header: Worker badge + Phase + State icon */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className="text-xs bg-gray-700 text-gray-300">
            W{worker_id}
          </Badge>
          {lastActivity && (
            <Badge
              className={cn(
                "text-[10px]",
                isAmazon
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-blue-500/20 text-blue-400"
              )}
            >
              {isAmazon ? (
                <ShoppingCart className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <Search className="h-2.5 w-2.5 mr-0.5" />
              )}
              {isAmazon ? "Amazon" : "eBay"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastActivity?.duration_ms && (
            <span className="text-[10px] text-gray-500">
              {lastActivity.duration_ms}ms
            </span>
          )}
          <StateIcon state={state} />
        </div>
      </div>

      {/* State label */}
      <div
        className={cn(
          "text-sm font-medium",
          isIdle ? "text-gray-500" : "text-white"
        )}
      >
        {stateLabel(state)}
      </div>

      {/* Search query / product name (when active) */}
      {!isIdle && (params?.query || lastActivity?.product_name || lastActivity?.category) && (
        <div className="mt-1.5 text-xs text-gray-300 line-clamp-2">
          {params?.query || lastActivity?.product_name || lastActivity?.category}
        </div>
      )}

      {/* eBay Parameters (compact grid) */}
      {!isIdle && isEbay && params && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {/* Price range */}
          {(params.price_min || params.price_max) && (
            <div className="flex items-center gap-1 text-emerald-400">
              <DollarSign className="h-3 w-3" />
              <span>
                {params.price_min ? formatPrice(params.price_min) : "$0"} - {params.price_max ? formatPrice(params.price_max) : "∞"}
              </span>
            </div>
          )}
          {/* Page */}
          {params.page && (
            <div className="flex items-center gap-1 text-gray-400">
              <Package className="h-3 w-3" />
              <span>Page {params.page}</span>
            </div>
          )}
          {/* Indicators */}
          <div className="flex items-center gap-1.5">
            <span className="text-green-400" title="Brand New">NEW</span>
            <span title="Free Shipping"><Truck className="h-3 w-3 text-blue-400" /></span>
            <span title="US Only"><Globe className="h-3 w-3 text-purple-400" /></span>
          </div>
        </div>
      )}

      {/* Amazon Parameters */}
      {!isIdle && isAmazon && params?.node_id && (
        <div className="mt-2 text-[10px] text-gray-400">
          Node: {params.node_id}
        </div>
      )}

      {/* URL (truncated, clickable) */}
      {!isIdle && lastActivity?.url && (
        <a
          href={lastActivity.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 truncate"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate hover:underline">{truncateUrl(lastActivity.url)}</span>
        </a>
      )}

      {/* Result summary (when found/error) */}
      {lastActivity && (lastActivity.action === "found" || lastActivity.action === "error") && (
        <div
          className={cn(
            "text-xs mt-2 pt-2 border-t border-gray-700/50",
            lastActivity.action === "error" ? "text-red-400" : "text-green-400"
          )}
        >
          {lastActivity.action === "found" ? (
            <>
              Found {lastActivity.new_sellers_count || 0}{" "}
              {isAmazon ? "products" : "sellers"}
            </>
          ) : (
            <>Error: {lastActivity.error_message?.slice(0, 40) || "Unknown"}</>
          )}
        </div>
      )}
    </div>
  );
}
