"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, Pause, Play, Square, ShoppingCart, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ProgressBarProps {
  progress: {
    run_id: string;
    status: "running" | "paused" | "pending";
    phase: "amazon" | "ebay";  // Current phase
    // Amazon phase fields
    departments_total: number;
    departments_completed: number;
    categories_total: number;
    categories_completed: number;
    products_found: number;  // Live count during Amazon phase
    // eBay phase fields
    products_total: number;
    products_searched: number;
    sellers_found: number;
    sellers_new: number;
    started_at?: string;  // For duration display
    // Checkpoint for throttle status and current activity
    checkpoint?: {
      status?: "rate_limited" | "paused_failures" | string;
      waiting_seconds?: number;
      current_category?: string;
      current_activity?: string;  // Human-readable: "Category > Product Title"
    };
  } | null;
  onDetailsClick: () => void;
  onRunStateChange: () => void;
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

export function ProgressBar({ progress, onDetailsClick, onRunStateChange }: ProgressBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [duration, setDuration] = useState<string>("");
  const supabase = createClient();

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

  // Calculate progress percentage based on phase
  const getProgressPercent = () => {
    if (phase === "amazon") {
      // Amazon phase: progress based on categories
      return progress.categories_total > 0
        ? (progress.categories_completed / progress.categories_total) * 100
        : 0;
    } else {
      // eBay phase: progress based on products searched
      return progress.products_total > 0
        ? (progress.products_searched / progress.products_total) * 100
        : 0;
    }
  };

  const progressPercent = getProgressPercent();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-2 bg-gray-800">
        <div
          className={`h-full transition-all duration-300 ${
            phase === "amazon" ? "bg-orange-500" : "bg-blue-500"
          }`}
          style={{ width: `${progressPercent}%` }}
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
      <div className="px-4 py-2 flex items-center justify-between text-sm gap-4">
        {/* Left side: Phase badge + current activity */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              {/* Phase badge */}
              <Badge
                className={`text-xs ${
                  phase === "amazon"
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {phase === "amazon" ? (
                  <>
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Finding Products
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    Searching Sellers
                  </>
                )}
              </Badge>
            </motion.div>
          </AnimatePresence>

          {/* Current activity text with animation */}
          <AnimatePresence mode="wait">
            <motion.span
              key={progress.checkpoint?.current_activity || "idle"}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="text-gray-400 truncate min-w-0"
              title={progress.checkpoint?.current_activity}
            >
              {progress.checkpoint?.current_activity || "Starting..."}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Right side: Stats */}
        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
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

          {phase === "amazon" ? (
            /* Amazon phase: Show products found (live count, no denominator) */
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Products:</span>
              <span className="text-orange-400 font-medium">
                {progress.products_found || 0}
              </span>
            </div>
          ) : (
            /* eBay phase: Show products searched / total + new sellers */
            <>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Products:</span>
                <span className="text-gray-300">
                  {progress.products_searched}/{progress.products_total}
                </span>
              </div>

              <span className="text-gray-700">|</span>

              {/* New Sellers */}
              <div className="flex items-center gap-1">
                <span className="text-gray-500">+New:</span>
                <span className="text-green-400 font-medium">
                  {progress.sellers_new}
                </span>
              </div>
            </>
          )}

          {/* Duration */}
          {duration && (
            <>
              <span className="text-gray-700">|</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Time:</span>
                <span className="text-gray-400">{duration}</span>
              </div>
            </>
          )}
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
