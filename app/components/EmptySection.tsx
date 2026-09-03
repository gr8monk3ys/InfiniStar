import type { ComponentType, ReactNode } from "react"
import { HiOutlineExclamationTriangle } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"

interface EmptySectionProps {
  /** Headline for the state. Written as a sentence, never a bare "No data". */
  title: string
  /** What is missing and what the reader can do about it. */
  description: ReactNode
  /** Links or buttons that resolve the emptiness. */
  action?: ReactNode
  /**
   * `empty` means the query succeeded and there is genuinely nothing yet.
   * `error` means the query failed, which is a different thing and must not
   * be dressed up as "no data yet".
   */
  variant?: "empty" | "error"
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  className?: string
}

/**
 * The one empty-state treatment for feed-style sections: a dashed-border panel
 * with real copy and a way forward. Every section that renders a grid from a
 * possibly-empty array should route its zero case through here so a heading can
 * never again sit above nothing.
 */
export function EmptySection({
  title,
  description,
  action,
  variant = "empty",
  icon: Icon,
  className,
}: EmptySectionProps) {
  const isError = variant === "error"
  const ResolvedIcon = Icon ?? (isError ? HiOutlineExclamationTriangle : undefined)

  return (
    <div
      role={isError ? "alert" : undefined}
      className={cn(
        "rounded-xl border border-dashed p-8",
        isError ? "border-destructive/40 bg-destructive/5" : "bg-card/30",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {ResolvedIcon ? (
          <ResolvedIcon
            className={cn("mt-0.5 size-5 shrink-0", isError ? "text-destructive" : "text-primary")}
            aria-hidden={true}
          />
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          {action ? <div className="mt-5 flex flex-wrap gap-3">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default EmptySection
