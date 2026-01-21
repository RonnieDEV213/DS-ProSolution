import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface EnhancedProgress {
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

export function useCollectionPolling(pollingInterval = 2000) {
  const [activeRun, setActiveRun] = useState<CollectionRun | null>(null);
  const [progress, setProgress] = useState<EnhancedProgress | null>(null);
  const [newSellerIds, setNewSellerIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  // Check for active run
  const checkActiveRun = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(`${API_BASE}/collection/runs?limit=1`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

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
      // Suppress transient network errors during polling (common with dev servers)
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${API_BASE}/collection/runs/${run.id}/progress`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setProgress({
          ...data,
          run_id: run.id,
          status: run.status,
        });
      }
    } catch (e) {
      // Suppress transient network errors during polling
      if (e instanceof TypeError && (e as Error).message === "Failed to fetch") {
        return;
      }
      console.error("Failed to fetch progress:", e);
    }
  }, [supabase.auth]);

  // Polling effect
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;

      const run = await checkActiveRun();
      if (run && (run.status === "running" || run.status === "paused")) {
        await fetchProgress(run);
      } else {
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
    };
  }, [checkActiveRun, fetchProgress, pollingInterval]);

  // Track new sellers added during this session
  const addNewSellerId = useCallback((id: string) => {
    setNewSellerIds((prev) => new Set([...prev, id]));
  }, []);

  const clearNewSellerIds = useCallback(() => {
    setNewSellerIds(new Set());
  }, []);

  return {
    activeRun,
    progress,
    newSellerIds,
    addNewSellerId,
    clearNewSellerIds,
    refresh: checkActiveRun,
  };
}
