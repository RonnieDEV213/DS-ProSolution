"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Hook for polling automation data with visibility pause.
 * Pauses polling when the browser tab is not visible.
 */
export function useAutomationPolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 5000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);

  // Keep fetcher ref up to date
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const poll = useCallback(async () => {
    // Pause when tab not visible
    if (document.visibilityState !== "visible") return;

    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const doPoll = async () => {
      if (!active) return;
      await poll();
    };

    doPoll(); // Initial fetch
    const interval = setInterval(doPoll, intervalMs);

    // Visibility change handler - poll immediately when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        doPoll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [poll, intervalMs]);

  return { data, loading, error, refetch };
}
