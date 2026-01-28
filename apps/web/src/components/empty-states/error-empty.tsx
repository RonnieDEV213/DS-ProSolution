import { EmptyState } from "./empty-state"
import { ErrorIllustration } from "./illustrations"
import { Button } from "@/components/ui/button"

interface ErrorEmptyProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorEmpty({ message, onRetry, className }: ErrorEmptyProps) {
  return (
    <EmptyState
      illustration={<ErrorIllustration />}
      title="Something went wrong"
      description={message ?? "We couldn't load this data. Please try again."}
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        ) : undefined
      }
      className={className}
    />
  )
}
