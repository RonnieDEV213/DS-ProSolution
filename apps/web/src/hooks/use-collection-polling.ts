import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Timeout for polling requests - abort if taking too long to prevent request buildup
const POLLING_TIMEOUT_MS = 3000;

interface EnhancedProgress {
  run_id: string;
  status: "running" | "paused" | "pending";
  phase: "amazon" | "ebay";  // Current phase of collection
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
  worker_status: Array<{
    worker_id: number;
    department: string;
    category: string;
    product: string | null;
    status: "idle" | "fetching" | "searching" | "complete";
  }>;
}

interface CollectionRun {
  id: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
}

export function useCollectionPolling(pollingInterval = 500) {
  const [activeRun, setActiveRun] = useState<CollectionRun | null>(null);
  const [progress, setProgress] = useState<EnhancedProgress | null>(null);
  const [newSellerIds, setNewSellerIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  // Refs to track and cancel in-flight requests
  const activeRunAbortRef = useRef<AbortController | null>(null);
  const progressAbortRef = useRef<AbortController | null>(null);

  // Check for active run
  const checkActiveRun = useCallback(async () => {
    // Abort any previous in-flight request
    if (activeRunAbortRef.current) {
      activeRunAbortRef.current.abort();
    }

    const controller = new AbortController();
    activeRunAbortRef.current = controller;

    // Set timeout to auto-abort
    const timeoutId = setTimeout(() => controller.abort(), POLLING_TIMEOUT_MS);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        clearTimeout(timeoutId);
        return null;
      }

      const response = await fetch(`${API_BASE}/collection/runs?limit=1`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const runs = data.runs || [];
        const active = runs.find(
          (r: CollectionRun) => r.status === "running" || r.status === "paused"
        );
        setActiveRun(active || null);
        return active || null;
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // Suppress transient network errors and abort errors during polling
      if (e instanceof Error && e.name === "AbortError") {
        return null;
      }
      if (e instanceof TypeError && (e as Error).message === "Failed to fetch") {
        // Silently ignore - will retry on next poll
        return null;
      }
      console.error("Failed to check active run:", e);
    }
    return null;
  }, [supabase.auth]);

  // Fetch progress for active run
  const fetchProgress = useCallback(async (run: CollectionRun) => {
    // Abort any previous in-flight request
    if (progressAbortRef.current) {
      progressAbortRef.current.abort();
    }

    const controller = new AbortController();
    progressAbortRef.current = controller;

    // Set timeout to auto-abort
    const timeoutId = setTimeout(() => controller.abort(), POLLING_TIMEOUT_MS);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        clearTimeout(timeoutId);
        return;
      }

      const response = await fetch(
        `${API_BASE}/collection/runs/${run.id}/progress`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Provide defaults for new fields for backwards compatibility
        setProgress({
          ...data,
          run_id: run.id,
          status: run.status,
          // Default phase to "amazon" if backend hasn't been updated
          phase: data.phase || "amazon",
          // Default products_found to 0 if not provided
          products_found: data.products_found ?? 0,
        });
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // Suppress transient network errors and abort errors during polling
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      if (e instanceof TypeError && (e as Error).message === "Failed to fetch") {
        return;
      }
      console.error("Failed to fetch progress:", e);
    }
  }, [supabase.auth]);

  // Track consecutive failures to avoid flicker on transient errors
  const consecutiveFailuresRef = useRef(0);
  const MAX_FAILURES_BEFORE_CLEAR = 3;

  // Polling effect
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;

      const run = await checkActiveRun();
      if (run && (run.status === "running" || run.status === "paused")) {
        consecutiveFailuresRef.current = 0; // Reset on success
        await fetchProgress(run);
      } else if (run === null) {
        // Only clear progress after multiple consecutive failures to avoid flicker
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= MAX_FAILURES_BEFORE_CLEAR) {
          setProgress(null);
        }
        // Otherwise keep showing last known progress
      } else {
        // Run exists but is not running/paused (completed, cancelled, etc.)
        consecutiveFailuresRef.current = 0;
        setProgress(null);
      }
    };

    // Initial check
    poll();

    // Set up polling interval
    const interval = setInterval(poll, pollingInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
      // Abort any in-flight requests on cleanup
      if (activeRunAbortRef.current) {
        activeRunAbortRef.current.abort();
      }
      if (progressAbortRef.current) {
        progressAbortRef.current.abort();
      }
    };
  }, [checkActiveRun, fetchProgress, pollingInterval]);

  // Track new sellers added during this session
  const addNewSellerId = useCallback((id: string) => {
    setNewSellerIds((prev) => new Set([...prev, id]));
  }, []);

  const clearNewSellerIds = useCallback(() => {
    setNewSellerIds(new Set());
  }, []);

  // Full refresh that updates both activeRun AND progress
  // Use this after pause/resume/cancel to immediately reflect the new state
  const refreshAll = useCallback(async () => {
    const run = await checkActiveRun();
    if (run && (run.status === "running" || run.status === "paused")) {
      await fetchProgress(run);
    } else {
      setProgress(null);
    }
  }, [checkActiveRun, fetchProgress]);

  return {
    activeRun,
    progress,
    newSellerIds,
    addNewSellerId,
    clearNewSellerIds,
    refresh: refreshAll,  // Use refreshAll instead of just checkActiveRun
  };
}
