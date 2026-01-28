import { EmptyState } from "./empty-state"
import { SearchIllustration } from "./illustrations"

interface NoResultsProps {
  searchTerm?: string
  className?: string
}

export function NoResults({ searchTerm, className }: NoResultsProps) {
  return (
    <EmptyState
      illustration={<SearchIllustration />}
      title="No results found"
      description={
        searchTerm
          ? `No results match "${searchTerm}". Try a different search term.`
          : "No results match your search. Try adjusting your query."
      }
      className={className}
    />
  )
}
