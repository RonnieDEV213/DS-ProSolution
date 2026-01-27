'use client';

import { useEffect, useState } from 'react';
import { CloudOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useSyncStatus } from '@/hooks/sync/use-sync-status';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
 *
 * Collapsed sidebar: icon-only with tooltip.
 */
export function SyncStatusIndicator() {
  const { status, pendingCount, lastSyncAt, error, retry } = useSyncStatus();
  const { state } = useSidebar();

  // Delay expand so icon-only view persists during sidebar width transition
  const [collapsed, setCollapsed] = useState(state === 'collapsed');
  useEffect(() => {
    if (state === 'collapsed') {
      setCollapsed(true);
    } else {
      const timeout = setTimeout(() => setCollapsed(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [state]);

  // Hidden when idle (clean, unobtrusive UX)
  if (status === 'idle') {
    // Still show last synced time if available (expanded only)
    if (lastSyncAt && !collapsed) {
      return (
        <div className="mb-2 px-4 py-2">
          <span className="text-xs text-muted-foreground">
            Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
          </span>
        </div>
      );
    }
    return null;
  }

  const statusIcon = (
    <>
      {status === 'syncing' && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
      )}
      {status === 'error' && (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
      )}
      {status === 'offline' && (
        <CloudOff className="h-4 w-4 shrink-0 text-yellow-400" />
      )}
    </>
  );

  const statusText =
    status === 'syncing'
      ? `Syncing${pendingCount > 0 ? ` ${pendingCount} records` : '...'}`
      : status === 'error'
        ? (error || 'Sync failed')
        : 'Offline';

  // Collapsed: icon-only with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={status === 'error' ? retry : undefined}
            className="flex h-8 w-8 items-center justify-center rounded-md mx-auto hover:bg-sidebar-accent transition-colors"
          >
            {statusIcon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <p>{statusText}</p>
          {lastSyncAt && (
            <p className="text-muted-foreground">
              Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded: full layout
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
          {statusIcon}

          <span
            className={cn(
              'text-xs font-medium',
              status === 'syncing' && 'text-blue-400',
              status === 'error' && 'text-red-400',
              status === 'offline' && 'text-yellow-400'
            )}
          >
            {statusText}
          </span>

          {status === 'error' && (
            <button
              onClick={retry}
              className="ml-auto p-1 rounded hover:bg-sidebar-accent transition-colors"
              title="Retry sync"
            >
              <RefreshCw className="h-3 w-3 text-red-400 hover:text-red-300" />
            </button>
          )}
        </div>

        {lastSyncAt && (
          <div className="mt-1">
            <span className="text-xs text-muted-foreground">
              Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
