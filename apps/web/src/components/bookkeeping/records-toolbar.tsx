"use client";

import { useMemo, useState } from "react";
import { Keyboard, Rows2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuickFilterChips } from "@/components/bookkeeping/quick-filter-chips";
import { KeyboardShortcutsModal } from "@/components/bookkeeping/keyboard-shortcuts-modal";
import type { RowDensity } from "@/hooks/use-row-density";

interface RecordsToolbarProps {
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  density: RowDensity;
  onToggleDensity: () => void;
  recordCount: number;
  isFiltered: boolean;
  helpOpen?: boolean;
  onHelpOpenChange?: (open: boolean) => void;
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
}: RecordsToolbarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
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
    </div>
  );
}
