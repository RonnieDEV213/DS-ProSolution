"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, Pause, Play, Square, ShoppingCart, Search, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ProgressBarProps {
  progress: {
    run_id: string;
    status: "running" | "paused" | "pending" | "completed" | "cancelled";
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
  onRunStateChange: () => void | Promise<void>;
}

// Transitional action state
type PendingAction = "pausing" | "resuming" | "cancelling" | null;

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
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [duration, setDuration] = useState<string>("");
  const supabase = createClient();

  // Track previous status to detect transitions
  const prevStatusRef = useRef<string | null>(null);
  const pendingActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timeout to auto-clear pending action if it takes too long (10 seconds)
  useEffect(() => {
    if (pendingAction) {
      // Clear any existing timeout
      if (pendingActionTimeoutRef.current) {
        clearTimeout(pendingActionTimeoutRef.current);
      }
      // Set new timeout to revert after 10 seconds
      pendingActionTimeoutRef.current = setTimeout(() => {
        console.warn(`Action "${pendingAction}" timed out after 10 seconds, reverting`);
        setPendingAction(null);
      }, 10000);
    } else {
      // Clear timeout when action completes
      if (pendingActionTimeoutRef.current) {
        clearTimeout(pendingActionTimeoutRef.current);
        pendingActionTimeoutRef.current = null;
      }
    }

    return () => {
      if (pendingActionTimeoutRef.current) {
        clearTimeout(pendingActionTimeoutRef.current);
      }
    };
  }, [pendingAction]);

  // Clear pending action when status actually changes
  useEffect(() => {
    if (!progress) {
      setPendingAction(null);
      prevStatusRef.current = null;
      return;
    }

    const currentStatus = progress.status;
    const prevStatus = prevStatusRef.current;

    // Detect status transitions and clear pending action
    if (prevStatus && prevStatus !== currentStatus) {
      // Status changed - clear pending action
      if (pendingAction === "pausing" && currentStatus === "paused") {
        setPendingAction(null);
      } else if (pendingAction === "resuming" && currentStatus === "running") {
        setPendingAction(null);
      } else if (pendingAction === "cancelling" && (currentStatus === "cancelled" || currentStatus === "completed")) {
        setPendingAction(null);
      }
    }

    prevStatusRef.current = currentStatus;
  }, [progress?.status, pendingAction]);

  // Update duration timer every second (pauses when run is paused or transitioning)
  useEffect(() => {
    if (!progress?.started_at) {
      setDuration("");
      return;
    }

    // Calculate initial duration
    setDuration(formatDuration(progress.started_at));

    // Only keep updating if running (not paused or transitioning)
    if (progress.status === "paused" || pendingAction) {
      // When paused or transitioning, keep showing the last duration but don't update
      return;
    }

    const interval = setInterval(() => {
      setDuration(formatDuration(progress.started_at!));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress?.started_at, progress?.status, pendingAction]);

  if (!progress) return null;

  // Default phase to "amazon" for backwards compatibility
  const phase = progress.phase || "amazon";

  const handlePauseResume = async () => {
    const action = progress.status === "paused" ? "resume" : "pause";
    console.log(`[handlePauseResume] progress.status=${progress.status}, action=${action}`);
    setPendingAction(action === "pause" ? "pausing" : "resuming");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("[handlePauseResume] No session, returning early");
        setPendingAction(null);
        return;
      }

      const url = `${API_BASE}/collection/runs/${progress.run_id}/${action}`;
      console.log(`[handlePauseResume] Calling ${url}`);

      // Use AbortController with 5-second timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[handlePauseResume] Request timed out after 5 seconds, aborting`);
        controller.abort();
      }, 5000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`[handlePauseResume] Response: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[handlePauseResume] Error: ${errorText}`);
          // Clear pending action on API error so UI reflects true state
          setPendingAction(null);
          return;
        }

        // Trigger refresh - polling will detect actual status change
        await onRunStateChange();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          console.error("[handlePauseResume] Request was aborted (timeout)");
        } else {
          throw fetchError;
        }
        setPendingAction(null);
      }
    } catch (e) {
      console.error("Failed to pause/resume run:", e);
      setPendingAction(null);
    }
  };

  const handleCancel = async () => {
    setPendingAction("cancelling");
    console.log(`[handleCancel] Cancelling run ${progress.run_id}`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("[handleCancel] No session, returning early");
        setPendingAction(null);
        return;
      }

      const url = `${API_BASE}/collection/runs/${progress.run_id}/cancel`;
      console.log(`[handleCancel] Calling ${url}`);

      // Use AbortController with 5-second timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[handleCancel] Request timed out after 5 seconds, aborting`);
        controller.abort();
      }, 5000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`[handleCancel] Response: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[handleCancel] Error: ${errorText}`);
          setPendingAction(null);
          return;
        }

        // Trigger refresh - polling will detect actual status change
        await onRunStateChange();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          console.error("[handleCancel] Request was aborted (timeout)");
        } else {
          throw fetchError;
        }
        setPendingAction(null);
      }
    } catch (e) {
      console.error("Failed to cancel run:", e);
      setPendingAction(null);
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

  // Get status display info (combines phase + status + transition)
  const getStatusDisplay = () => {
    // Transitional states take priority
    if (pendingAction === "pausing") {
      return {
        text: "Pausing...",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
        className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      };
    }
    if (pendingAction === "resuming") {
      return {
        text: "Resuming...",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
        className: "bg-green-500/20 text-green-400 border-green-500/30",
      };
    }
    if (pendingAction === "cancelling") {
      return {
        text: "Cancelling...",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
        className: "bg-red-500/20 text-red-400 border-red-500/30",
      };
    }

    // Paused state
    if (progress.status === "paused") {
      return {
        text: "Paused",
        icon: <Pause className="h-3 w-3 mr-1" />,
        className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      };
    }

    // Running - show phase info with animated icon
    if (phase === "amazon") {
      return {
        text: "Finding Products",
        icon: <ShoppingCart className="h-3 w-3 mr-1 animate-pulse" />,
        className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      };
    } else {
      return {
        text: "Searching Sellers",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" style={{ animationDuration: "2s" }} />,
        className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Determine progress bar color based on state
  const getProgressBarColor = () => {
    if (pendingAction === "cancelling") return "bg-red-500";
    if (pendingAction === "pausing" || progress.status === "paused") return "bg-yellow-500";
    if (pendingAction === "resuming") return "bg-green-500";
    return phase === "amazon" ? "bg-orange-500" : "bg-blue-500";
  };

  // Determine if we should animate (running or transitioning)
  const isAnimating = progress.status === "running" || !!pendingAction;
  const isPaused = progress.status === "paused" && !pendingAction;

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-2 bg-muted overflow-hidden relative">
        <motion.div
          className={`h-full ${getProgressBarColor()}`}
          animate={{
            width: `${progressPercent}%`,
            opacity: pendingAction ? [1, 0.5, 1] : 1,
          }}
          transition={{
            width: { duration: 0.5, ease: "easeOut" },
            opacity: {
              duration: pendingAction ? 1 : 0.3,
              repeat: pendingAction ? Infinity : 0,
            },
          }}
        />
        {/* Shimmer effect when running */}
        {isAnimating && !isPaused && (
          <motion.div
            className="absolute top-0 left-0 h-full w-[30%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ["-100%", "400%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ width: `${Math.max(progressPercent * 0.3, 10)}%` }}
          />
        )}
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
        {/* Left side: Combined status badge */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${phase}-${progress.status}-${pendingAction}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              {/* Combined status badge */}
              <Badge className={`text-xs ${statusDisplay.className}`}>
                {statusDisplay.icon}
                {statusDisplay.text}
              </Badge>
            </motion.div>
          </AnimatePresence>

          {/* Current activity (when running) */}
          {progress.status === "running" && !pendingAction && progress.checkpoint?.current_activity && (
            <span className="text-muted-foreground text-xs truncate max-w-[200px]">
              {progress.checkpoint.current_activity}
            </span>
          )}
        </div>

        {/* Right side: Stats */}
        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
          {/* Departments */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Depts:</span>
            <span className="text-foreground font-mono">
              {progress.departments_completed}/{progress.departments_total}
            </span>
          </div>

          <span className="text-border">|</span>

          {/* Categories */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Cats:</span>
            <span className="text-foreground font-mono">
              {progress.categories_completed}/{progress.categories_total}
            </span>
          </div>

          <span className="text-border">|</span>

          {phase === "amazon" ? (
            /* Amazon phase: Show products found (live count, no denominator) */
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Products:</span>
              <span className="text-orange-400 font-medium font-mono">
                {progress.products_found || 0}
              </span>
            </div>
          ) : (
            /* eBay phase: Show products searched / total + new sellers */
            <>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Products:</span>
                <span className="text-foreground font-mono">
                  {progress.products_searched}/{progress.products_total}
                </span>
              </div>

              <span className="text-border">|</span>

              {/* New Sellers */}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">+New:</span>
                <span className="text-green-400 font-medium font-mono">
                  {progress.sellers_new}
                </span>
              </div>
            </>
          )}

          {/* Duration */}
          {duration && (
            <>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Time:</span>
                <span className="text-muted-foreground font-mono">{duration}</span>
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
            disabled={!!pendingAction}
            className="h-7 px-2"
            title={progress.status === "paused" ? "Resume" : "Pause"}
          >
            {pendingAction === "pausing" ? (
              <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
            ) : pendingAction === "resuming" ? (
              <Loader2 className="h-4 w-4 text-green-400 animate-spin" />
            ) : progress.status === "paused" ? (
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
            disabled={!!pendingAction}
            className="h-7 px-2"
            title="Cancel"
          >
            {pendingAction === "cancelling" ? (
              <Loader2 className="h-4 w-4 text-red-400 animate-spin" />
            ) : (
              <Square className="h-4 w-4 text-red-400" />
            )}
          </Button>

          {/* Details */}
          <button
            onClick={() => {
              setExpanded(!expanded);
              onDetailsClick();
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
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
