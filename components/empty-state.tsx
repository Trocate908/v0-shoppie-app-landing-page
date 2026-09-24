import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Shared empty-state block. The product views (browse, market grid, vendor
 *  dashboard) all need the same "nothing here yet" treatment, so keep it in
 *  one place instead of repeating the dashed-border markup inline. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  minHeightClassName = "min-h-[320px]",
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** Override the default block height (e.g. "min-h-[200px]") when the
   *  surrounding layout already fills the viewport. */
  minHeightClassName?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card/50 px-6",
        minHeightClassName,
        className
      )}
    >
      <div className="max-w-sm text-center">
        {Icon && (
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
        <p className="text-base font-bold text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

export default EmptyState
