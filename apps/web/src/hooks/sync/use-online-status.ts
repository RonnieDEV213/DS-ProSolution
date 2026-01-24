'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribe to online/offline browser events.
 * Returns cleanup function per React useSyncExternalStore pattern.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Get current online status from navigator.
 */
function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * Server-side snapshot - assume online during SSR.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Hook to track browser online/offline status.
 * Uses React's useSyncExternalStore for proper subscription handling.
 *
 * @returns boolean - true if online, false if offline
 *
 * @example
 * const isOnline = useOnlineStatus();
 * if (!isOnline) {
 *   return <div>You are offline</div>;
 * }
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
