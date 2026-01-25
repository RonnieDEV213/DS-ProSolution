'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ExportNotificationOptions {
  onDownload?: () => void;
}

/**
 * Hook for browser notifications when background exports complete.
 * Shows toast when tab is active, browser notification when backgrounded.
 */
export function useExportNotification({ onDownload }: ExportNotificationOptions = {}) {
  const permissionRef = useRef<NotificationPermission>('default');

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    permissionRef.current = Notification.permission;

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        permissionRef.current = permission;
      });
    }
  }, []);

  const showNotification = useCallback(
    (title: string, message: string, isError: boolean = false) => {
      // Always show toast (works when tab is focused)
      if (isError) {
        toast.error(message);
      } else {
        toast.success(message, {
          action: onDownload
            ? {
                label: 'Download',
                onClick: onDownload,
              }
            : undefined,
          duration: 10000, // Keep visible longer for action
        });
      }

      // Show browser notification if tab is not visible and permission granted
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        permissionRef.current === 'granted' &&
        'Notification' in window
      ) {
        try {
          const notification = new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            tag: 'export-complete',
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
            if (onDownload && !isError) {
              onDownload();
            }
          };

          // Auto-close after 10 seconds
          setTimeout(() => notification.close(), 10000);
        } catch {
          // Notification API may fail in some contexts
        }
      }
    },
    [onDownload]
  );

  const notifyComplete = useCallback(
    (rowCount?: number) => {
      const countText = rowCount ? ` (${rowCount.toLocaleString()} rows)` : '';
      showNotification('Export Complete', `Your export is ready for download${countText}`);
    },
    [showNotification]
  );

  const notifyError = useCallback(
    (error: string) => {
      showNotification('Export Failed', error, true);
    },
    [showNotification]
  );

  return {
    notifyComplete,
    notifyError,
    hasPermission: permissionRef.current === 'granted',
  };
}
