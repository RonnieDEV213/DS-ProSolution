'use client';

import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface UsePrefetchOnScrollOptions {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
  threshold?: number; // 0-1, default 0.75 (75%)
}

interface UsePrefetchOnScrollResult {
  prefetchSentinelRef: (node?: Element | null) => void;
}

/**
 * Triggers prefetch when user scrolls to threshold position.
 * Uses IntersectionObserver for efficient scroll detection.
 *
 * Place the sentinel element at the end of your list:
 * <div ref={prefetchSentinelRef} style={{ height: 1 }} />
 */
export function usePrefetchOnScroll({
  hasNextPage,
  isFetching,
  fetchNextPage,
  threshold = 0.75,
}: UsePrefetchOnScrollOptions): UsePrefetchOnScrollResult {
  const { ref, inView } = useInView({
    threshold: 0,
    // Trigger when sentinel is (1-threshold) of viewport height away
    // e.g., threshold 0.75 means trigger when 25% from bottom
    rootMargin: `${Math.round((1 - threshold) * 100)}% 0px`,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      console.log('[Prefetch] Triggering next page fetch');
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  return { prefetchSentinelRef: ref };
}
