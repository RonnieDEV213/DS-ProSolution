import { EmptyState } from "./empty-state"
import { FilterIllustration } from "./illustrations"
import { Button } from "@/components/ui/button"

interface FilteredEmptyProps {
  onClearFilters?: () => void
  className?: string
}

export function FilteredEmpty({ onClearFilters, className }: FilteredEmptyProps) {
  return (
    <EmptyState
      illustration={<FilterIllustration />}
      title="No matching results"
      description="No items match your current filters. Try adjusting or clearing your filters."
      action={
        onClearFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        ) : undefined
      }
      className={className}
    />
  )
}
