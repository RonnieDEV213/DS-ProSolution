"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const QUICK_FILTERS = [
  { id: "all", label: "All" },
  { id: "successful", label: "Successful", status: "SUCCESSFUL" },
  { id: "return_label", label: "Return Label", status: "RETURN_LABEL_PROVIDED" },
  { id: "return_closed", label: "Return Closed", status: "RETURN_CLOSED" },
  { id: "refunds", label: "Refunds", status: "REFUND_NO_RETURN" },
];

interface QuickFilterChipsProps {
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export function QuickFilterChips({
  activeFilter,
  onFilterChange,
}: QuickFilterChipsProps) {
  const handleClick = (filterId: string) => {
    onFilterChange(filterId === activeFilter ? "all" : filterId);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label="Status filters"
    >
      {QUICK_FILTERS.map((filter) => {
        const isActive = filter.id === activeFilter;
        return (
          <Badge
            key={filter.id}
            variant={isActive ? "default" : "outline"}
            className="cursor-pointer select-none"
            onClick={() => handleClick(filter.id)}
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
          onClick={() => onFilterChange("all")}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
