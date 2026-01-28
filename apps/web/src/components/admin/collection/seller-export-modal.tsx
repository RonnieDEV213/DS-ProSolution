'use client';

import { useState, useCallback, useMemo } from 'react';
import { Download, FileText, Braces, ClipboardCopy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useFlagSeller } from '@/hooks/mutations/use-flag-seller';
import { getAccessToken } from '@/lib/api';
import type { SellerRecord } from '@/lib/db/schema';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Server-side streaming export threshold (sellers)
const LARGE_EXPORT_THRESHOLD = 10_000;

type ExportFormat = 'csv' | 'json' | 'clipboard';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileText }[] = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'json', label: 'JSON', icon: Braces },
  { value: 'clipboard', label: 'Clipboard', icon: ClipboardCopy },
];

interface SellerExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellers: SellerRecord[];
  totalCount: number;
  onExportComplete?: () => void;
}

/**
 * Export modal for seller collection, matching the order tracking ExportDialog layout.
 * Encapsulates all export state: format, flag-on-export, first N, range.
 * Records export events via POST /sellers/log-export after every successful export.
 */
export function SellerExportModal({
  open,
  onOpenChange,
  sellers,
  totalCount,
  onExportComplete,
}: SellerExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [flagOnExport, setFlagOnExport] = useState(true);
  const [firstN, setFirstN] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const flagMutation = useFlagSeller();

  // Compute filtered sellers based on firstN / range options
  const filteredSellers = useMemo(() => {
    let filtered = [...sellers];

    const n = parseInt(firstN, 10);
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);

    if (!isNaN(n) && n > 0) {
      filtered = filtered.slice(0, n);
    } else if (!isNaN(start) && !isNaN(end) && start >= 1 && end >= start) {
      filtered = filtered.slice(start - 1, end);
    }

    return filtered;
  }, [sellers, firstN, rangeStart, rangeEnd]);

  const previewCount = filteredSellers.length;

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setFormat('csv');
        setFlagOnExport(true);
        setFirstN('');
        setRangeStart('');
        setRangeEnd('');
        setIsExporting(false);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Helper: trigger blob download
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Flag exported sellers (only those not already flagged)
  const flagExportedSellers = useCallback(
    (sellerIds: string[]) => {
      if (!flagOnExport || sellerIds.length === 0) return;

      const idsToFlag = sellerIds.filter((id) => {
        const seller = sellers.find((s) => s.id === id);
        return seller && !seller.flagged;
      });

      for (const id of idsToFlag) {
        flagMutation.mutate({ id, flagged: true });
      }
    },
    [flagOnExport, sellers, flagMutation]
  );

  // Log export event to backend audit log
  const logExportEvent = useCallback(
    async (sellerNames: string[], exportFormat: string) => {
      try {
        const token = await getAccessToken();
        await fetch(`${API_BASE}/sellers/log-export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            seller_names: sellerNames,
            export_format: exportFormat,
          }),
        });
      } catch (error) {
        // Log failure should not block the export
        console.error('Failed to log export event:', error);
      }
    },
    []
  );

  // Server-side streaming export (authenticated fetch + blob download)
  const serverSideExport = useCallback(
    async (fmt: 'csv' | 'json') => {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (flagOnExport) params.set('flagged', 'false');
      const url = `${API_BASE}/export/sellers/${fmt}?${params}`;

      const res = await fetch(url, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) {
        toast.error(`Export failed: ${res.statusText}`);
        return false;
      }

      const blob = await res.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      downloadBlob(blob, `sellers_${dateStr}.${fmt}`);
      return true;
    },
    [flagOnExport]
  );

  // Export handler
  const handleExport = useCallback(async () => {
    if (filteredSellers.length === 0) return;
    setIsExporting(true);

    try {
      const sellerNames = filteredSellers.map((s) => s.display_name);
      let success = false;

      if (format === 'csv') {
        // Route to server-side streaming for large datasets
        if (totalCount > LARGE_EXPORT_THRESHOLD) {
          success = (await serverSideExport('csv')) ?? false;
        } else {
          const headers = ['display_name', 'platform', 'times_seen', 'updated_at'];
          const rows = filteredSellers.map((s) => [
            `"${s.display_name.replace(/"/g, '""')}"`,
            s.platform,
            s.times_seen,
            s.updated_at || '',
          ]);

          const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          downloadBlob(blob, `sellers_${new Date().toISOString().split('T')[0]}.csv`);
          success = true;
        }
      } else if (format === 'json') {
        if (totalCount > LARGE_EXPORT_THRESHOLD) {
          success = (await serverSideExport('json')) ?? false;
        } else {
          const data = {
            exported_at: new Date().toISOString(),
            count: filteredSellers.length,
            sellers: filteredSellers.map((s) => ({
              display_name: s.display_name,
              platform: s.platform,
              times_seen: s.times_seen,
              updated_at: s.updated_at,
            })),
          };

          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json',
          });
          downloadBlob(blob, `sellers_${new Date().toISOString().split('T')[0]}.json`);
          success = true;
        }
      } else if (format === 'clipboard') {
        const text = filteredSellers.map((s) => s.display_name).join('\n');
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${filteredSellers.length} seller names to clipboard`);
        success = true;
      }

      if (success) {
        // Flag exported sellers if enabled
        flagExportedSellers(filteredSellers.map((s) => s.id));

        // Record export event in audit log
        await logExportEvent(sellerNames, format);

        // Notify parent
        onExportComplete?.();

        // Close modal
        handleOpenChange(false);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [
    filteredSellers,
    format,
    totalCount,
    serverSideExport,
    flagExportedSellers,
    logExportEvent,
    onExportComplete,
    handleOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Sellers
          </DialogTitle>
          <DialogDescription>
            Export {sellers.length.toLocaleString()} seller
            {sellers.length !== 1 ? 's' : ''} to a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Format</Label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={format === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat(option.value)}
                  disabled={isExporting}
                  className="flex-1"
                >
                  <option.icon className="h-4 w-4 mr-1" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Flag on Export Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="flag-on-export"
              checked={flagOnExport}
              onCheckedChange={(checked) => setFlagOnExport(checked === true)}
              disabled={isExporting}
              className="border-border data-[state=checked]:bg-yellow-600"
            />
            <Label
              htmlFor="flag-on-export"
              className="text-foreground text-sm cursor-pointer"
            >
              Flag exported sellers
            </Label>
          </div>

          {/* First N Input */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              First N (optional)
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="Export first N sellers"
              value={firstN}
              onChange={(e) => {
                setFirstN(e.target.value);
                if (e.target.value) {
                  setRangeStart('');
                  setRangeEnd('');
                }
              }}
              disabled={isExporting}
              className="bg-card border-border text-foreground h-8 text-sm"
            />
          </div>

          {/* Range Inputs */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              Range (optional)
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                placeholder="From"
                value={rangeStart}
                onChange={(e) => {
                  setRangeStart(e.target.value);
                  if (e.target.value) setFirstN('');
                }}
                disabled={isExporting}
                className="bg-card border-border text-foreground h-8 text-sm"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="number"
                min="1"
                placeholder="To"
                value={rangeEnd}
                onChange={(e) => {
                  setRangeEnd(e.target.value);
                  if (e.target.value) setFirstN('');
                }}
                disabled={isExporting}
                className="bg-card border-border text-foreground h-8 text-sm"
              />
            </div>
          </div>

          {/* Preview Count */}
          <div className="text-sm text-muted-foreground text-center py-1 bg-card rounded font-mono">
            {previewCount.toLocaleString()} sellers
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || previewCount === 0}
          >
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
