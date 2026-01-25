'use client';

import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { retryMutation } from '@/lib/db/pending-mutations';
import type { PendingMutation } from '@/lib/db';

interface SyncRowBadgeProps {
  mutation: PendingMutation | undefined;
}

/**
 * Row-level sync status badge component.
 *
 * Per CONTEXT.md:
 * - Only show pending and error states, no badge when synced
 * - Pending state: small spinning dot (subtle animated indicator)
 * - Error state: hover tooltip shows error message + includes retry button
 */
export function SyncRowBadge({ mutation }: SyncRowBadgeProps) {
  // Per CONTEXT.md: only show pending and error states, no badge when synced
  if (!mutation) return null;

  if (mutation.status === 'pending' || mutation.status === 'in-flight') {
    // Pending: small spinning dot per CONTEXT.md
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Syncing changes...</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (mutation.status === 'failed') {
    // Error: hover tooltip with error message + retry button per CONTEXT.md
    const handleRetry = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await retryMutation(mutation.id);
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            <AlertCircle className="h-3 w-3 text-red-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex flex-col gap-2 max-w-xs">
          <p className="text-red-300">{mutation.last_error || 'Sync failed'}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={handleRetry}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
