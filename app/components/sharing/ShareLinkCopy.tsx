"use client"

import { useState } from "react"
import { Check, Copy, Link } from "lucide-react"
import toast from "react-hot-toast"

import { cn } from "@/app/lib/utils"
import { Button } from "@/app/components/ui/button"

interface ShareLinkCopyProps {
  shareUrl: string
  className?: string
  variant?: "default" | "compact"
}

export function ShareLinkCopy({ shareUrl, className, variant = "default" }: ShareLinkCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  if (variant === "compact") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className={cn("gap-2", className)}
        aria-label="Copy share link"
      >
        {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
        <span className="sr-only">Copy link</span>
      </Button>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex flex-1 items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <Link className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 bg-transparent text-sm focus:outline-none"
          aria-label="Share URL"
        />
      </div>
      <Button
        onClick={handleCopy}
        variant="secondary"
        className="gap-2"
        aria-label="Copy share link"
      >
        {copied ? (
          <>
            <Check className="size-4 text-green-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-4" />
            Copy
          </>
        )}
      </Button>
    </div>
  )
}

export default ShareLinkCopy
