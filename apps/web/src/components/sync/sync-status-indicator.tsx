'use client';

import { CloudOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useSyncStatus } from '@/hooks/sync/use-sync-status';
import { cn } from '@/lib/utils';

/**
 * Sync status indicator for the admin sidebar.
 *
 * Displays:
 * - Hidden when idle (fully synced)
 * - Spinner + count when syncing
 * - Error icon + retry button when failed
 * - Offline icon when network unavailable
 * - "Last synced X ago" timestamp
 */
export function SyncStatusIndicator() {
  const { status, pendingCount, lastSyncAt, error, retry } = useSyncStatus();

  // Hidden when idle (clean, unobtrusive UX)
  if (status === 'idle') {
    // Still show last synced time if available
    if (lastSyncAt) {
      return (
        <div className="mb-2 px-4 py-2">
          <span className="text-xs text-gray-500">
            Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className="mb-2 px-4 py-2"
      >
        <div className="flex items-center gap-2">
          {/* Status Icon */}
          {status === 'syncing' && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          {status === 'offline' && (
            <CloudOff className="h-4 w-4 text-yellow-400" />
          )}

          {/* Status Text */}
          <span
            className={cn(
              'text-xs font-medium',
              status === 'syncing' && 'text-blue-400',
              status === 'error' && 'text-red-400',
              status === 'offline' && 'text-yellow-400'
            )}
          >
            {status === 'syncing' &&
              `Syncing${pendingCount > 0 ? ` ${pendingCount} records` : '...'}`}
            {status === 'error' && (error || 'Sync failed')}
            {status === 'offline' && 'Offline'}
          </span>

          {/* Retry Button (error state only) */}
          {status === 'error' && (
            <button
              onClick={retry}
              className="ml-auto p-1 rounded hover:bg-gray-800 transition-colors"
              title="Retry sync"
            >
              <RefreshCw className="h-3 w-3 text-red-400 hover:text-red-300" />
            </button>
          )}
        </div>

        {/* Last Synced Timestamp (when not idle) */}
        {lastSyncAt && (
          <div className="mt-1">
            <span className="text-xs text-gray-500">
              Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
