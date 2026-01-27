import { EmptyState } from "./empty-state"
import { EmptyBoxIllustration } from "./illustrations"
import { Button } from "@/components/ui/button"

interface FirstTimeEmptyProps {
  entityName: string       // e.g., "orders", "accounts", "users"
  actionLabel?: string     // e.g., "Create Order", "Add Account"
  onAction?: () => void    // CTA click handler
  description?: string     // Custom description override
  className?: string
}

export function FirstTimeEmpty({
  entityName,
  actionLabel,
  onAction,
  description,
  className,
}: FirstTimeEmptyProps) {
  return (
    <EmptyState
      illustration={<EmptyBoxIllustration />}
      title={`No ${entityName} yet`}
      description={description ?? `Get started by creating your first ${entityName.replace(/s$/, "")}.`}
      action={
        actionLabel && onAction ? (
          <Button onClick={onAction}>{actionLabel}</Button>
        ) : undefined
      }
      className={className}
    />
  )
}
