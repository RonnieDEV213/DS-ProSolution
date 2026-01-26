'use client';

import { Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExportJobStatus } from '@/lib/api';

interface ExportProgressProps {
  job: ExportJobStatus | null;
  isExporting: boolean;
  error: string | null;
  onDownload: () => void;
}

/**
 * Export progress indicator component.
 * Shows spinner when exporting, row count when processing,
 * download button when complete, error message on failure.
 */
export function ExportProgress({
  job,
  isExporting,
  error,
  onDownload,
}: ExportProgressProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">{error}</span>
      </div>
    );
  }

  if (!isExporting && !job) {
    return null;
  }

  // Streaming export in progress (no job)
  if (isExporting && !job) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Preparing download...</span>
      </div>
    );
  }

  // Background job status
  if (job) {
    switch (job.status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Starting export...</span>
          </div>
        );

      case 'processing':
        return (
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Exporting{job.row_count ? <span className="font-mono"> {job.row_count.toLocaleString()} rows</span> : ''}...
            </span>
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-muted-foreground text-sm">
              <span className="font-mono">{job.row_count?.toLocaleString()}</span> rows ready
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="ml-2"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        );

      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{job.error || 'Export failed'}</span>
          </div>
        );

      default:
        return null;
    }
  }

  return null;
}
