"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, Eye, Link, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"
import toast from "react-hot-toast"

import { cn } from "@/app/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

export interface ShareItem {
  id: string
  shareToken: string
  shareUrl: string
  shareType: "LINK" | "INVITE"
  permission: "VIEW" | "PARTICIPATE"
  name: string | null
  expiresAt: string | null
  maxUses: number | null
  useCount: number
  isActive: boolean
  allowedEmails: string[]
  createdAt: string
}

interface ActiveSharesProps {
  shares: ShareItem[]
  onDelete: (shareId: string) => Promise<void>
  onEdit?: (share: ShareItem) => void
  onToggleActive?: (shareId: string, isActive: boolean) => Promise<void>
  className?: string
  isLoading?: boolean
}

export function ActiveShares({
  shares,
  onDelete,
  onEdit,
  onToggleActive,
  className,
  isLoading = false,
}: ActiveSharesProps) {
  const [deleteShareId, setDeleteShareId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCopyLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Link copied to clipboard")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleDelete = async () => {
    if (!deleteShareId) return

    setIsDeleting(true)
    try {
      await onDelete(deleteShareId)
      toast.success("Share link deleted")
    } catch {
      toast.error("Failed to delete share link")
    } finally {
      setIsDeleting(false)
      setDeleteShareId(null)
    }
  }

  const handleToggleActive = async (share: ShareItem) => {
    if (!onToggleActive) return

    try {
      await onToggleActive(share.id, !share.isActive)
      toast.success(share.isActive ? "Share link disabled" : "Share link enabled")
    } catch {
      toast.error("Failed to update share link")
    }
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isMaxUsesReached = (maxUses: number | null, useCount: number) => {
    if (!maxUses) return false
    return useCount >= maxUses
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
    )
  }

  if (shares.length === 0) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <Link className="mx-auto size-12 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">No active share links</p>
        <p className="text-sm text-muted-foreground">
          Create a share link to let others join this conversation
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("space-y-3", className)}>
        {shares.map((share) => {
          const expired = isExpired(share.expiresAt)
          const maxReached = isMaxUsesReached(share.maxUses, share.useCount)
          const isDisabled = !share.isActive || expired || maxReached

          return (
            <div key={share.id} className={cn("rounded-lg border p-4", isDisabled && "opacity-60")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate font-medium">{share.name || "Untitled Share"}</h4>
                    <div className="flex gap-1">
                      <Badge variant={share.shareType === "LINK" ? "secondary" : "outline"}>
                        {share.shareType === "LINK" ? (
                          <Link className="mr-1 size-3" />
                        ) : (
                          <Users className="mr-1 size-3" />
                        )}
                        {share.shareType === "LINK" ? "Public" : "Invite"}
                      </Badge>
                      <Badge variant={share.permission === "VIEW" ? "secondary" : "default"}>
                        {share.permission === "VIEW" ? (
                          <Eye className="mr-1 size-3" />
                        ) : (
                          <Pencil className="mr-1 size-3" />
                        )}
                        {share.permission === "VIEW" ? "View" : "Participate"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      Created{" "}
                      {formatDistanceToNow(new Date(share.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span>
                      {share.useCount} use{share.useCount !== 1 ? "s" : ""}
                      {share.maxUses && ` / ${share.maxUses} max`}
                    </span>
                    {share.expiresAt && (
                      <span className={cn(expired && "text-red-500")}>
                        {expired
                          ? "Expired"
                          : `Expires ${formatDistanceToNow(new Date(share.expiresAt), {
                              addSuffix: true,
                            })}`}
                      </span>
                    )}
                  </div>

                  {share.shareType === "INVITE" && share.allowedEmails.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">
                        Invited: {share.allowedEmails.slice(0, 3).join(", ")}
                        {share.allowedEmails.length > 3 &&
                          ` +${share.allowedEmails.length - 3} more`}
                      </span>
                    </div>
                  )}

                  {!share.isActive && (
                    <Badge variant="destructive" className="mt-2">
                      Disabled
                    </Badge>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyLink(share.shareUrl)}>
                      <Copy className="mr-2 size-4" />
                      Copy Link
                    </DropdownMenuItem>
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(share)}>
                        <Pencil className="mr-2 size-4" />
                        Edit Settings
                      </DropdownMenuItem>
                    )}
                    {onToggleActive && (
                      <DropdownMenuItem onClick={() => handleToggleActive(share)}>
                        {share.isActive ? (
                          <>
                            <Eye className="mr-2 size-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 size-4" />
                            Enable
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteShareId(share.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog open={!!deleteShareId} onOpenChange={() => setDeleteShareId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Share Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this share link? Anyone who has the link will no
              longer be able to join this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ActiveShares
