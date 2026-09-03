"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { HiArrowPath } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

interface RetryButtonProps {
  label?: string
  className?: string
}

/**
 * Re-runs the server render for the current route. Used by error states so a
 * failed query can be retried in place instead of forcing a full page reload.
 */
export function RetryButton({ label = "Try again", className }: RetryButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className={cn(buttonVariants({ size: "sm" }), "gap-2", className)}
    >
      <HiArrowPath className={cn("size-4", isPending && "animate-spin")} aria-hidden={true} />
      {isPending ? "Retrying…" : label}
    </button>
  )
}

export default RetryButton
