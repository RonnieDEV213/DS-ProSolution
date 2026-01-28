"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { queryKeys } from "@/lib/query-keys";
import { getAccessToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
  const [newSellerIds, setNewSellerIds] = useState<Set<string>>(new Set());

  // Query for active run - polls continuously to detect new runs
  const {
    data: activeRun,
    refetch: refetchActiveRun,
  } = useQuery({
    queryKey: queryKeys.collection.runs.active(),
    queryFn: async ({ signal }): Promise<CollectionRun | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      const response = await fetch(`${API_BASE}/collection/runs?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (!response.ok) return null;
      const data = await response.json();
      const runs = data.runs || [];
      return runs.find(
        (r: CollectionRun) => r.status === "running" || r.status === "paused"
      ) || null;
    },
    refetchInterval: pollingInterval,
    // Stop polling when page is not visible (built-in TanStack Query behavior)
    refetchIntervalInBackground: false,
    // Don't show error toasts for polling failures
    retry: false,
    // Stale time 0 - always refetch on interval
    staleTime: 0,
  });

  // Query for progress (only runs when activeRun exists and is active)
  const {
    data: progress,
  } = useQuery({
    queryKey: queryKeys.collection.runs.progress(activeRun?.id ?? ""),
    queryFn: async ({ signal }): Promise<EnhancedProgress | null> => {
      if (!activeRun) return null;

      const token = await getAccessToken();
      if (!token) return null;

      const response = await fetch(
        `${API_BASE}/collection/runs/${activeRun.id}/progress`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        }
      );

      if (!response.ok) return null;
      const data = await response.json();
      return {
        ...data,
        run_id: activeRun.id,
        status: activeRun.status,
        // Default phase to "amazon" if backend hasn't been updated
        phase: data.phase || "amazon",
        // Default products_found to 0 if not provided
        products_found: data.products_found ?? 0,
      };
    },
    enabled: !!activeRun && (activeRun.status === "running" || activeRun.status === "paused"),
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 0,
  });

  // Track new sellers added during this session
  const addNewSellerId = useCallback((id: string) => {
    setNewSellerIds((prev) => new Set([...prev, id]));
  }, []);

  const clearNewSellerIds = useCallback(() => {
    setNewSellerIds(new Set());
  }, []);

  // Full refresh that forces re-fetch of active run and progress
  const refreshAll = useCallback(async () => {
    await refetchActiveRun();
  }, [refetchActiveRun]);

  return {
    activeRun: activeRun ?? null,
    progress: progress ?? null,
    newSellerIds,
    addNewSellerId,
    clearNewSellerIds,
    refresh: refreshAll,
  };
}
