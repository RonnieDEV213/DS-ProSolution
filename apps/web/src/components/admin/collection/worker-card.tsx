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
  ArrowRight,
  Truck,
  Globe,
  ExternalLink,
  Tag,
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
  "border-cyan-500/50 hover:border-cyan-500",
];

const workerBgColors = [
  "bg-blue-500/10",
  "bg-green-500/10",
  "bg-purple-500/10",
  "bg-orange-500/10",
  "bg-pink-500/10",
  "bg-cyan-500/10",
];

const workerAccentColors = [
  "text-blue-400",
  "text-green-400",
  "text-purple-400",
  "text-orange-400",
  "text-pink-400",
  "text-cyan-400",
];

function StateIcon({ state, className }: { state: WorkerState; className?: string }) {
  const baseClass = cn("h-4 w-4", className);
  switch (state) {
    case "searching_products":
    case "searching_sellers":
      return <Loader2 className={cn(baseClass, "animate-spin")} />;
    case "returning_products":
    case "returning_sellers":
      return <CheckCircle className={cn(baseClass, "text-green-400")} />;
    case "rate_limited":
      return <Clock className={cn(baseClass, "text-yellow-400")} />;
    case "error":
      return <AlertCircle className={cn(baseClass, "text-red-400")} />;
    case "complete":
      return <CheckCircle className={cn(baseClass, "text-emerald-400")} />;
    default:
      return <User className={cn(baseClass, "text-muted-foreground")} />;
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
  const hasResult = lastActivity?.action === "found" || lastActivity?.action === "error";

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border-2 cursor-pointer transition-all",
        workerColors[colorIdx],
        isIdle ? "bg-muted/30" : workerBgColors[colorIdx],
        "hover:bg-accent/50"
      )}
    >
      {/* Row 1: Worker ID + Phase + Status + Duration */}
      <div className="flex items-center gap-2 mb-2">
        {/* Worker badge with larger presence */}
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md font-bold text-sm font-mono",
          isIdle ? "bg-muted text-muted-foreground" : "bg-card " + workerAccentColors[colorIdx]
        )}>
          W{worker_id}
        </div>

        {/* Phase badge */}
        {lastActivity && (
          <Badge
            className={cn(
              "text-[10px] px-1.5",
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

        {/* Status text */}
        <span className={cn(
          "text-sm font-medium flex-1",
          isIdle ? "text-muted-foreground" : "text-foreground"
        )}>
          {stateLabel(state)}
        </span>

        {/* Duration + State icon */}
        <div className="flex items-center gap-1.5">
          {lastActivity?.duration_ms && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {lastActivity.duration_ms}ms
            </span>
          )}
          <StateIcon state={state} />
        </div>
      </div>

      {/* Row 2: Search query / product name - full width */}
      {!isIdle && (params?.query || lastActivity?.product_name || lastActivity?.category) && (
        <div className="text-xs text-muted-foreground truncate mb-2">
          {params?.query || lastActivity?.product_name || lastActivity?.category}
        </div>
      )}

      {/* Row 3: All details in one horizontal line with dividers */}
      {!isIdle && (
        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          {/* eBay: Price flow */}
          {isEbay && params?.amazon_price && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-orange-400 font-mono">{formatPrice(params.amazon_price)}</span>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-emerald-400 font-mono">
                  {params.price_min ? formatPrice(params.price_min) : "$0"}-{params.price_max ? formatPrice(params.price_max) : "..."}
                </span>
              </div>
              <span className="text-border">|</span>
            </>
          )}

          {/* Page */}
          {isEbay && params?.page && (
            <>
              <span className="text-muted-foreground font-mono">Page {params.page}</span>
              <span className="text-border">|</span>
            </>
          )}

          {/* eBay Filters */}
          {isEbay && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-green-400 font-medium" title="Brand New">NEW</span>
                <span title="Free Shipping"><Truck className="h-3 w-3 text-blue-400" /></span>
                <span title="US Only"><Globe className="h-3 w-3 text-purple-400" /></span>
              </div>
              <span className="text-border">|</span>
            </>
          )}

          {/* Amazon: Node ID */}
          {isAmazon && params?.node_id && (
            <>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Tag className="h-3 w-3" />
                <span className="font-mono">Node: {params.node_id}</span>
              </div>
              <span className="text-border">|</span>
            </>
          )}

          {/* URL */}
          {lastActivity?.url && (
            <>
              <a
                href={lastActivity.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="hover:underline">View</span>
              </a>
              {hasResult && <span className="text-border">|</span>}
            </>
          )}

          {/* Result */}
          {hasResult && (
            <span
              className={cn(
                "font-medium font-mono",
                lastActivity?.action === "error" ? "text-red-400" : "text-green-400"
              )}
            >
              {lastActivity?.action === "found" ? (
                <>+{lastActivity.new_sellers_count || 0} {isAmazon ? "products" : "sellers"}</>
              ) : (
                <>Error</>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
