'use client';

import { useState, useCallback, useMemo } from 'react';
import { Download, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { ExportProgress } from './export-progress';
import { useExportRecords } from '@/hooks/use-export-records';
import {
  EXPORT_COLUMNS,
  COLUMN_LABELS,
  type ExportFormat,
  type BookkeepingStatus,
} from '@/lib/api';

// Background export threshold
const BACKGROUND_THRESHOLD = 10000;

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  totalRecords: number;
  filters?: {
    status?: BookkeepingStatus;
    dateFrom?: string;
    dateTo?: string;
  };
}

type ColumnPreset = 'essential' | 'financial' | 'all';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileText }[] = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'json', label: 'JSON', icon: FileJson },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
];

/**
 * Export configuration dialog with column selection and format picker.
 */
export function ExportDialog({
  open,
  onOpenChange,
  accountId,
  totalRecords,
  filters,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [preset, setPreset] = useState<ColumnPreset>('essential');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(EXPORT_COLUMNS.essential)
  );

  const { isExporting, currentJob, error, startExport, downloadFile, reset } = useExportRecords({
    accountId,
    totalRecords,
    filters,
  });

  const isBackgroundExport = totalRecords >= BACKGROUND_THRESHOLD;

  // Handle preset change
  const handlePresetChange = useCallback((newPreset: ColumnPreset) => {
    setPreset(newPreset);
    setSelectedColumns(new Set(EXPORT_COLUMNS[newPreset]));
  }, []);

  // Handle individual column toggle
  const handleColumnToggle = useCallback((column: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(column);
      } else {
        next.delete(column);
      }
      return next;
    });
    // Clear preset when manually selecting
    setPreset('all');
  }, []);

  // Check if current selection matches a preset
  const matchingPreset = useMemo(() => {
    const essential = EXPORT_COLUMNS.essential;
    const financial = EXPORT_COLUMNS.financial;
    const all = EXPORT_COLUMNS.all;

    const isEqual = (a: readonly string[], b: Set<string>) =>
      a.length === b.size && a.every((col) => b.has(col));

    if (isEqual(essential, selectedColumns)) return 'essential';
    if (isEqual(financial, selectedColumns)) return 'financial';
    if (isEqual(all, selectedColumns)) return 'all';
    return null;
  }, [selectedColumns]);

  // Start export handler
  const handleExport = useCallback(async () => {
    const columns = Array.from(selectedColumns);
    await startExport(format, columns);
  }, [format, selectedColumns, startExport]);

  // Handle dialog close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        reset();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, reset]
  );

  // Export complete - close dialog or keep open for background download
  const hasCompletedJob = currentJob?.status === 'completed';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Records
          </DialogTitle>
          <DialogDescription>
            Export {totalRecords.toLocaleString()} record{totalRecords !== 1 ? 's' : ''} to a file.
            {isBackgroundExport && (
              <span className="block text-yellow-500 mt-1">
                Large export ({totalRecords.toLocaleString()} rows) will run in the background.
                You&apos;ll be notified when it&apos;s ready.
              </span>
            )}
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

          {/* Column Presets */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Column Preset</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={matchingPreset === 'essential' || preset === 'essential' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetChange('essential')}
                disabled={isExporting}
                className="flex-1"
              >
                Essential
              </Button>
              <Button
                type="button"
                variant={matchingPreset === 'financial' || preset === 'financial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetChange('financial')}
                disabled={isExporting}
                className="flex-1"
              >
                Financial
              </Button>
              <Button
                type="button"
                variant={matchingPreset === 'all' || preset === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetChange('all')}
                disabled={isExporting}
                className="flex-1"
              >
                All Columns
              </Button>
            </div>
          </div>

          {/* Individual Column Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Columns ({selectedColumns.size} selected)
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-950">
              {EXPORT_COLUMNS.all.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800 p-1 rounded"
                >
                  <Checkbox
                    checked={selectedColumns.has(column)}
                    onCheckedChange={(checked) =>
                      handleColumnToggle(column, checked === true)
                    }
                    disabled={isExporting}
                  />
                  <span className="truncate">{COLUMN_LABELS[column] || column}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Export Progress */}
          {(isExporting || currentJob || error) && (
            <div className="pt-2 border-t border-gray-800">
              <ExportProgress
                job={currentJob}
                isExporting={isExporting}
                error={error}
                onDownload={downloadFile}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {hasCompletedJob ? 'Close' : 'Cancel'}
          </Button>
          {!hasCompletedJob && (
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedColumns.size === 0}
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
