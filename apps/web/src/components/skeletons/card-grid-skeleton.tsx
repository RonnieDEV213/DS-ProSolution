import { Skeleton } from "@/components/ui/skeleton"

interface CardGridSkeletonProps {
  cards?: number
  columns?: string
}

export function CardGridSkeleton({
  cards = 6,
  columns = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
}: CardGridSkeletonProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Card grid */}
      <div className={`grid ${columns} gap-4`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
