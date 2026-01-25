'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exportApi,
  type ExportFormat,
  type ExportJobStatus,
  type ExportParams,
  type BookkeepingStatus,
} from '@/lib/api';
import { useExportNotification } from './use-export-notification';

// Threshold for background export (matches backend)
const BACKGROUND_EXPORT_THRESHOLD = 10000;

// Poll interval for background job status
const POLL_INTERVAL_MS = 2000;

interface UseExportRecordsOptions {
  accountId: string;
  totalRecords: number;
  filters?: {
    status?: BookkeepingStatus;
    dateFrom?: string;
    dateTo?: string;
  };
}

interface UseExportRecordsResult {
  isExporting: boolean;
  currentJob: ExportJobStatus | null;
  error: string | null;
  startExport: (format: ExportFormat, columns?: string[]) => Promise<void>;
  downloadFile: () => void;
  reset: () => void;
}

/**
 * Hook for exporting records with streaming or background job support.
 * Automatically chooses streaming for small datasets (<10K rows),
 * background job for large datasets.
 */
export function useExportRecords({
  accountId,
  totalRecords,
  filters,
}: UseExportRecordsOptions): UseExportRecordsResult {
  const [isExporting, setIsExporting] = useState(false);
  const [currentJob, setCurrentJob] = useState<ExportJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle download action from notification
  const handleDownload = useCallback(() => {
    if (downloadBlob && downloadFilename) {
      triggerDownload(downloadBlob, downloadFilename);
    }
  }, [downloadBlob, downloadFilename]);

  const { notifyComplete, notifyError } = useExportNotification({
    onDownload: handleDownload,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Trigger browser download from blob
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Generate filename based on format and date
  const generateFilename = useCallback(
    (format: ExportFormat) => {
      const date = new Date().toISOString().split('T')[0];
      const ext = format === 'excel' ? 'xlsx' : format;
      return `records_${accountId.slice(0, 8)}_${date}.${ext}`;
    },
    [accountId]
  );

  // Poll background job status
  const pollJobStatus = useCallback(
    async (jobId: string, format: ExportFormat) => {
      try {
        const status = await exportApi.getJobStatus(jobId);
        setCurrentJob(status);

        if (status.status === 'completed') {
          // Job complete, download file
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          const blob = await exportApi.downloadBackgroundExport(jobId);
          const filename = generateFilename(format);
          setDownloadBlob(blob);
          setDownloadFilename(filename);
          setIsExporting(false);
          notifyComplete(status.row_count ?? undefined);
        } else if (status.status === 'failed') {
          // Job failed
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setError(status.error || 'Export failed');
          setIsExporting(false);
          notifyError(status.error || 'Export failed');
        }
        // Still pending/processing, continue polling
      } catch (err) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to check export status';
        setError(errorMessage);
        setIsExporting(false);
        notifyError(errorMessage);
      }
    },
    [generateFilename, notifyComplete, notifyError]
  );

  // Start export (streaming or background based on record count)
  const startExport = useCallback(
    async (format: ExportFormat, columns?: string[]) => {
      // Reset state
      setError(null);
      setCurrentJob(null);
      setDownloadBlob(null);
      setDownloadFilename(null);
      setIsExporting(true);

      const params: ExportParams = {
        account_id: accountId,
        format,
        columns,
        status: filters?.status,
        date_from: filters?.dateFrom,
        date_to: filters?.dateTo,
      };

      try {
        if (totalRecords >= BACKGROUND_EXPORT_THRESHOLD) {
          // Use background export for large datasets
          const response = await exportApi.createBackgroundExport(params);

          setCurrentJob({
            job_id: response.job_id,
            status: 'pending',
            row_count: null,
            file_url: null,
            error: null,
            created_at: new Date().toISOString(),
            completed_at: null,
          });

          // Start polling for job status
          pollIntervalRef.current = setInterval(() => {
            pollJobStatus(response.job_id, format);
          }, POLL_INTERVAL_MS);

          // Also poll immediately
          pollJobStatus(response.job_id, format);
        } else {
          // Use streaming export for small datasets
          const blob = await exportApi.streamingExport(params);
          const filename = generateFilename(format);

          // Trigger download immediately
          triggerDownload(blob, filename);
          setIsExporting(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Export failed';

        // Check for "use streaming" error from backend (dataset too small for background)
        if (errorMessage.includes('USE_STREAMING')) {
          // Retry with streaming
          try {
            const blob = await exportApi.streamingExport(params);
            const filename = generateFilename(format);
            triggerDownload(blob, filename);
            setIsExporting(false);
            return;
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : 'Export failed');
            setIsExporting(false);
            return;
          }
        }

        setError(errorMessage);
        setIsExporting(false);
      }
    },
    [accountId, totalRecords, filters, generateFilename, triggerDownload, pollJobStatus]
  );

  // Manual download trigger (for completed background jobs)
  const downloadFile = useCallback(() => {
    if (downloadBlob && downloadFilename) {
      triggerDownload(downloadBlob, downloadFilename);
    }
  }, [downloadBlob, downloadFilename, triggerDownload]);

  // Reset state
  const reset = useCallback(() => {
    setIsExporting(false);
    setCurrentJob(null);
    setError(null);
    setDownloadBlob(null);
    setDownloadFilename(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  return {
    isExporting,
    currentJob,
    error,
    startExport,
    downloadFile,
    reset,
  };
}
