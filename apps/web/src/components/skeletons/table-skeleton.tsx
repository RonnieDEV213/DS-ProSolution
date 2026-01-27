import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  columns?: number
  rows?: number
}

export function TableSkeleton({ columns = 6, rows = 8 }: TableSkeletonProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar area */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64" /> {/* Search input */}
          <Skeleton className="h-9 w-24" /> {/* Filter button */}
        </div>
        <Skeleton className="h-9 w-28" /> {/* Action button */}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 h-10 bg-muted/50 border-b border-border">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 max-w-[120px]" />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 h-12 border-b border-border last:border-b-0">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-3 flex-1 max-w-[120px]" />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}
