"use client";

import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkerMetrics } from "./activity-feed";

interface MetricsSummaryProps {
  workerMetrics: Map<number, WorkerMetrics>;
  sellersFound: number;
  sellersNew: number;
  productsFound: number;
  phase: "amazon" | "ebay";
}

interface ErrorBreakdown {
  rate_limit: number;
  timeout: number;
  http_error: number;
  parse_error: number;
  other: number;
}

function aggregateMetrics(workerMetrics: Map<number, WorkerMetrics>): {
  totalRequests: number;
  totalSuccess: number;
  totalFailed: number;
  totalRetries: number;
  avgResponseTime: number;
  errorBreakdown: ErrorBreakdown;
} {
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalRetries = 0;
  let totalDuration = 0;

  const errorBreakdown: ErrorBreakdown = {
    rate_limit: 0,
    timeout: 0,
    http_error: 0,
    parse_error: 0,
    other: 0,
  };

  workerMetrics.forEach((metrics) => {
    totalRequests += metrics.api_requests_total;
    totalSuccess += metrics.api_requests_success;
    totalFailed += metrics.api_requests_failed;
    totalRetries += metrics.api_retries;
    totalDuration += metrics.total_duration_ms;

    // Aggregate error breakdown
    Object.entries(metrics.errors_by_type).forEach(([type, count]) => {
      if (type.includes("rate_limit") || type === "rate_limited") {
        errorBreakdown.rate_limit += count;
      } else if (type.includes("timeout")) {
        errorBreakdown.timeout += count;
      } else if (type.includes("http")) {
        errorBreakdown.http_error += count;
      } else if (type.includes("parse")) {
        errorBreakdown.parse_error += count;
      } else {
        errorBreakdown.other += count;
      }
    });
  });

  const avgResponseTime = totalRequests > 0
    ? Math.round(totalDuration / totalRequests)
    : 0;

  return {
    totalRequests,
    totalSuccess,
    totalFailed,
    totalRetries,
    avgResponseTime,
    errorBreakdown,
  };
}

function StatCard({
  icon,
  label,
  value,
  color = "text-white",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded p-2">
      <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase mb-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-lg font-bold", color)}>{value}</div>
    </div>
  );
}

export function MetricsSummary({
  workerMetrics,
  sellersFound,
  sellersNew,
  productsFound,
  phase,
}: MetricsSummaryProps) {
  const aggregated = aggregateMetrics(workerMetrics);
  const hasErrors = aggregated.totalFailed > 0;
  const totalErrors = Object.values(aggregated.errorBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Activity className="h-3 w-3" />}
          label="API Requests"
          value={aggregated.totalRequests}
        />
        <StatCard
          icon={<Clock className="h-3 w-3" />}
          label="Avg Response"
          value={`${aggregated.avgResponseTime}ms`}
        />
        <StatCard
          icon={<CheckCircle className="h-3 w-3" />}
          label="Success"
          value={aggregated.totalSuccess}
          color="text-green-400"
        />
        <StatCard
          icon={<XCircle className="h-3 w-3" />}
          label="Failed"
          value={aggregated.totalFailed}
          color={hasErrors ? "text-red-400" : "text-gray-400"}
        />
      </div>

      {/* Output stats */}
      <div className="grid grid-cols-2 gap-2">
        {phase === "amazon" ? (
          <StatCard
            icon={<ShoppingCart className="h-3 w-3" />}
            label="Products Found"
            value={productsFound}
            color="text-orange-400"
          />
        ) : (
          <>
            <StatCard
              icon={<Users className="h-3 w-3" />}
              label="Sellers Found"
              value={sellersFound}
              color="text-blue-400"
            />
            <StatCard
              icon={<Users className="h-3 w-3" />}
              label="New Sellers"
              value={`+${sellersNew}`}
              color="text-green-400"
            />
          </>
        )}
      </div>

      {/* Error breakdown (only if errors exist) */}
      {hasErrors && (
        <div className="p-3 rounded bg-red-900/20 border border-red-800/30">
          <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-medium">Error Breakdown ({totalErrors} total)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {aggregated.errorBreakdown.rate_limit > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Rate Limit</span>
                <Badge variant="outline" className="text-yellow-400 border-yellow-700">
                  {aggregated.errorBreakdown.rate_limit}
                </Badge>
              </div>
            )}
            {aggregated.errorBreakdown.timeout > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Timeout</span>
                <Badge variant="outline" className="text-orange-400 border-orange-700">
                  {aggregated.errorBreakdown.timeout}
                </Badge>
              </div>
            )}
            {aggregated.errorBreakdown.http_error > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">HTTP Error</span>
                <Badge variant="outline" className="text-red-400 border-red-700">
                  {aggregated.errorBreakdown.http_error}
                </Badge>
              </div>
            )}
            {aggregated.errorBreakdown.parse_error > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Parse Error</span>
                <Badge variant="outline" className="text-purple-400 border-purple-700">
                  {aggregated.errorBreakdown.parse_error}
                </Badge>
              </div>
            )}
            {aggregated.errorBreakdown.other > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Other</span>
                <Badge variant="outline" className="text-gray-400 border-gray-700">
                  {aggregated.errorBreakdown.other}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
