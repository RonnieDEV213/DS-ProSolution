"use client";

import { useMemo, useState } from "react";
import { Download, Keyboard, Rows2, Rows3, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuickFilterChips } from "@/components/bookkeeping/quick-filter-chips";
import { KeyboardShortcutsModal } from "@/components/bookkeeping/keyboard-shortcuts-modal";
import { ImportDialog } from "@/components/data-management/import-dialog";
import { ExportDialog } from "@/components/data-management/export-dialog";
import type { RowDensity } from "@/hooks/use-row-density";
import type { BookkeepingStatus } from "@/lib/api";

interface RecordsToolbarProps {
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  density: RowDensity;
  onToggleDensity: () => void;
  recordCount: number;
  isFiltered: boolean;
  helpOpen?: boolean;
  onHelpOpenChange?: (open: boolean) => void;
  /** Account ID for import/export (required for data operations) */
  accountId?: string;
  /** Total records for export (used to determine streaming vs background) */
  totalRecords?: number;
  /** Current filters to apply to export */
  filters?: {
    status?: BookkeepingStatus;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function RecordsToolbar({
  activeFilter,
  onFilterChange,
  density,
  onToggleDensity,
  recordCount,
  isFiltered,
  helpOpen,
  onHelpOpenChange,
  accountId,
  totalRecords = 0,
  filters,
}: RecordsToolbarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const isControlled = helpOpen !== undefined && onHelpOpenChange !== undefined;
  const open = isControlled ? helpOpen : internalOpen;
  const setOpen = isControlled ? onHelpOpenChange : setInternalOpen;

  const countLabel = useMemo(() => {
    const base = `${recordCount.toLocaleString()} record${
      recordCount === 1 ? "" : "s"
    }`;
    return isFiltered ? `${base} (filtered)` : base;
  }, [recordCount, isFiltered]);

  const DensityIcon = density === "compact" ? Rows3 : Rows2;
  const densityTooltip =
    density === "compact"
      ? "Switch to comfortable view"
      : "Switch to compact view";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <QuickFilterChips
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
        <div className="text-sm text-gray-400">{countLabel}</div>
      </div>

      <div className="flex items-center gap-2">
        {accountId && totalRecords > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setExportOpen(true)}
                className="h-8 w-8"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export records</TooltipContent>
          </Tooltip>
        )}

        {accountId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setImportOpen(true)}
                className="h-8 w-8"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import records</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onToggleDensity}
              className="h-8 w-8"
            >
              <DensityIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{densityTooltip}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setOpen(true)}
              className="h-8 w-8"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
        </Tooltip>
      </div>

      <KeyboardShortcutsModal
        open={open}
        onOpenChange={(nextOpen) => setOpen(nextOpen)}
      />

      {accountId && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          accountId={accountId}
        />
      )}
    </div>
  );
}
