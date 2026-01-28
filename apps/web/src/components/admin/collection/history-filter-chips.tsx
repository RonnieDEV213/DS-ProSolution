"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const HISTORY_FILTERS = [
  { id: "all", label: "All", actionTypes: null },
  { id: "exports", label: "Exports", actionTypes: ["export"] },
  { id: "flags", label: "Flags", actionTypes: ["flag"] },
  { id: "runs", label: "Runs", actionTypes: ["add"] },
  { id: "edits", label: "Edits", actionTypes: ["edit", "remove"] },
] as const;

interface HistoryFilterChipsProps {
  activeFilter: string;
  onFilterChange: (filterId: string, actionTypes: string[] | null) => void;
}

export function HistoryFilterChips({
  activeFilter,
  onFilterChange,
}: HistoryFilterChipsProps) {
  const handleClick = (filter: (typeof HISTORY_FILTERS)[number]) => {
    if (filter.id === activeFilter) {
      // Toggle back to "all" if clicking the active filter
      const allFilter = HISTORY_FILTERS[0];
      onFilterChange(allFilter.id, allFilter.actionTypes as string[] | null);
    } else {
      onFilterChange(
        filter.id,
        filter.actionTypes ? [...filter.actionTypes] : null
      );
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label="History type filters"
    >
      {HISTORY_FILTERS.map((filter) => {
        const isActive = filter.id === activeFilter;
        return (
          <Badge
            key={filter.id}
            variant={isActive ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => handleClick(filter)}
            role="radio"
            aria-checked={isActive}
          >
            {filter.label}
          </Badge>
        );
      })}
      {activeFilter !== "all" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onFilterChange("all", null)}
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
