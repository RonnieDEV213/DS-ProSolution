"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2, Pause, Play, Square } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ProgressBarProps {
  progress: {
    run_id: string;
    status: "running" | "paused" | "pending";
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
    // Checkpoint field for throttle status
    checkpoint?: {
      status?: "rate_limited" | "paused_failures" | string;
      waiting_seconds?: number;
      current_category?: string;
    };
  } | null;
  onDetailsClick: () => void;
  onRunStateChange: () => void;
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProgressBar({ progress, onDetailsClick, onRunStateChange }: ProgressBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClient();

  if (!progress) return null;

  const handlePauseResume = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const action = progress.status === "paused" ? "resume" : "pause";
      await fetch(`${API_BASE}/collection/runs/${progress.run_id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      onRunStateChange();
    } catch (e) {
      console.error("Failed to pause/resume run:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/collection/runs/${progress.run_id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      onRunStateChange();
    } catch (e) {
      console.error("Failed to cancel run:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const totalProgress = progress.products_total > 0
    ? (progress.products_searched / progress.products_total) * 100
    : 0;

  const costColorClass = {
    safe: "text-green-400",
    warning: "text-yellow-400",
    exceeded: "text-red-400",
  }[progress.cost_status];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-2 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Throttle status banner */}
      {progress.checkpoint?.status === "rate_limited" && progress.checkpoint?.waiting_seconds && (
        <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700/50 flex items-center gap-2 text-sm text-yellow-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting {progress.checkpoint.waiting_seconds} seconds before next request...</span>
        </div>
      )}

      {/* Quick info */}
      <div className="px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Cost */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">API cost so far:</span>
            <span className={costColorClass}>
              {formatCost(progress.actual_cost_cents)}
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">
              {formatCost(progress.budget_cap_cents)}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Departments */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Depts:</span>
            <span className="text-gray-300">
              {progress.departments_completed}/{progress.departments_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Categories */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Cats:</span>
            <span className="text-gray-300">
              {progress.categories_completed}/{progress.categories_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* Products */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Products:</span>
            <span className="text-gray-300">
              {progress.products_searched}/{progress.products_total}
            </span>
          </div>

          <span className="text-gray-700">|</span>

          {/* New Sellers */}
          <div className="flex items-center gap-1">
            <span className="text-gray-500">+New Sellers:</span>
            <span className="text-green-400 font-medium">
              {progress.sellers_new}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Pause/Resume */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePauseResume}
            disabled={actionLoading}
            className="h-7 px-2"
            title={progress.status === "paused" ? "Resume" : "Pause"}
          >
            {progress.status === "paused" ? (
              <Play className="h-4 w-4 text-green-400" />
            ) : (
              <Pause className="h-4 w-4 text-yellow-400" />
            )}
          </Button>

          {/* Cancel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={actionLoading}
            className="h-7 px-2"
            title="Cancel"
          >
            <Square className="h-4 w-4 text-red-400" />
          </Button>

          {/* Details */}
          <button
            onClick={() => {
              setExpanded(!expanded);
              onDetailsClick();
            }}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>Details</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
