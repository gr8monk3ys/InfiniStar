"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, Loader2, Plus, Settings } from "lucide-react"
import toast from "react-hot-toast"

import { api } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Separator } from "@/app/components/ui/separator"

import { ActiveShares, type ShareItem } from "./ActiveShares"
import { ShareInviteForm } from "./ShareInviteForm"
import { ShareLinkCopy } from "./ShareLinkCopy"
import {
  ShareSettings,
  type SharePermission,
  type ShareSettingsData,
  type ShareType,
} from "./ShareSettings"

interface ShareDialogProps {
  conversationId: string
  conversationName?: string
  isOpen: boolean
  onClose: () => void
}

type View = "list" | "create" | "edit"

const defaultSettings: ShareSettingsData = {
  shareType: "LINK",
  permission: "VIEW",
  expiresAt: null,
  maxUses: null,
  name: "",
}

export function ShareDialog({
  conversationId,
  conversationName,
  isOpen,
  onClose,
}: ShareDialogProps) {
  const [view, setView] = useState<View>("list")
  const [shares, setShares] = useState<ShareItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [settings, setSettings] = useState<ShareSettingsData>(defaultSettings)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null)
  const [editingShare, setEditingShare] = useState<ShareItem | null>(null)

  // Fetch shares when dialog opens
  const fetchShares = useCallback(async () => {
    if (!conversationId) return

    setIsLoading(true)
    try {
      const response = await api.get<{ shares: ShareItem[] }>(
        `/api/conversations/${conversationId}/share`,
        { showErrorToast: false }
      )
      setShares(response.shares || [])
    } catch {
      // Silent fail, will show empty state
      setShares([])
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (isOpen) {
      fetchShares()
      setView("list")
      setCreatedShareUrl(null)
      setSettings(defaultSettings)
      setInviteEmails([])
      setEditingShare(null)
    }
  }, [isOpen, fetchShares])

  // Create a new share
  const handleCreate = async () => {
    if (settings.shareType === "INVITE" && inviteEmails.length === 0) {
      toast.error("Please add at least one email address for invite-only shares")
      return
    }

    setIsCreating(true)
    try {
      // Get CSRF token
      await api.get("/api/csrf")

      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf-token="))
        ?.split("=")[1]

      const response = await api.post<{ share: ShareItem; shareUrl: string }>(
        `/api/conversations/${conversationId}/share`,
        {
          shareType: settings.shareType,
          permission: settings.permission,
          expiresAt: settings.expiresAt ? new Date(settings.expiresAt).toISOString() : null,
          maxUses: settings.maxUses,
          allowedEmails: settings.shareType === "INVITE" ? inviteEmails : [],
          name: settings.name || null,
        },
        {
          headers: {
            "X-CSRF-Token": csrfToken || "",
          },
        }
      )

      setCreatedShareUrl(response.shareUrl)
      setShares((prev) => [
        {
          ...response.share,
          shareUrl: response.shareUrl,
        },
        ...prev,
      ])
      toast.success("Share link created")
    } catch (error) {
      console.error("Failed to create share:", error)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete a share
  const handleDelete = async (shareId: string) => {
    // Get CSRF token
    await api.get("/api/csrf")

    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf-token="))
      ?.split("=")[1]

    await api.delete(`/api/conversations/${conversationId}/share/${shareId}`, {
      headers: {
        "X-CSRF-Token": csrfToken || "",
      },
    })

    setShares((prev) => prev.filter((share) => share.id !== shareId))
  }

  // Toggle share active state
  const handleToggleActive = async (shareId: string, isActive: boolean) => {
    // Get CSRF token
    await api.get("/api/csrf")

    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf-token="))
      ?.split("=")[1]

    const response = await api.patch<{ share: ShareItem; shareUrl: string }>(
      `/api/conversations/${conversationId}/share/${shareId}`,
      { isActive },
      {
        headers: {
          "X-CSRF-Token": csrfToken || "",
        },
      }
    )

    setShares((prev) =>
      prev.map((share) =>
        share.id === shareId ? { ...response.share, shareUrl: response.shareUrl } : share
      )
    )
  }

  // Edit share
  const handleEdit = (share: ShareItem) => {
    setEditingShare(share)
    setSettings({
      shareType: share.shareType as ShareType,
      permission: share.permission as SharePermission,
      expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString().slice(0, 16) : null,
      maxUses: share.maxUses,
      name: share.name || "",
    })
    setInviteEmails(share.allowedEmails)
    setView("edit")
  }

  // Update share
  const handleUpdate = async () => {
    if (!editingShare) return

    setIsCreating(true)
    try {
      // Get CSRF token
      await api.get("/api/csrf")

      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf-token="))
        ?.split("=")[1]

      const response = await api.patch<{ share: ShareItem; shareUrl: string }>(
        `/api/conversations/${conversationId}/share/${editingShare.id}`,
        {
          permission: settings.permission,
          expiresAt: settings.expiresAt ? new Date(settings.expiresAt).toISOString() : null,
          maxUses: settings.maxUses,
          allowedEmails: inviteEmails,
          name: settings.name || null,
        },
        {
          headers: {
            "X-CSRF-Token": csrfToken || "",
          },
        }
      )

      setShares((prev) =>
        prev.map((share) =>
          share.id === editingShare.id ? { ...response.share, shareUrl: response.shareUrl } : share
        )
      )
      toast.success("Share link updated")
      setView("list")
      setEditingShare(null)
    } catch (error) {
      console.error("Failed to update share:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleBack = () => {
    setView("list")
    setSettings(defaultSettings)
    setInviteEmails([])
    setCreatedShareUrl(null)
    setEditingShare(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="size-5" />
            {view === "list" && "Share Conversation"}
            {view === "create" && "Create Share Link"}
            {view === "edit" && "Edit Share Link"}
          </DialogTitle>
          <DialogDescription>
            {conversationName
              ? `Share "${conversationName}" with others`
              : "Share this conversation with others"}
          </DialogDescription>
        </DialogHeader>

        {view === "list" && (
          <>
            <div className="space-y-4">
              <Button onClick={() => setView("create")} className="w-full gap-2">
                <Plus className="size-4" />
                Create Share Link
              </Button>

              <Separator />

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Settings className="size-4" />
                  Active Share Links
                </h3>
                <ActiveShares
                  shares={shares}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </>
        )}

        {(view === "create" || view === "edit") && (
          <div className="space-y-6">
            {createdShareUrl ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                  <p className="mb-2 font-medium text-green-800 dark:text-green-200">
                    Share link created successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Copy the link below to share with others.
                  </p>
                </div>
                <ShareLinkCopy shareUrl={createdShareUrl} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleBack}>
                    Back to Shares
                  </Button>
                  <Button
                    onClick={() => {
                      setCreatedShareUrl(null)
                      setSettings(defaultSettings)
                      setInviteEmails([])
                    }}
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ShareSettings settings={settings} onChange={setSettings} />

                {settings.shareType === "INVITE" && (
                  <>
                    <Separator />
                    <ShareInviteForm emails={inviteEmails} onChange={setInviteEmails} />
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleBack}>
                    Cancel
                  </Button>
                  <Button
                    onClick={view === "edit" ? handleUpdate : handleCreate}
                    disabled={isCreating}
                  >
                    {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {view === "edit" ? "Update Share" : "Create Share"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ShareDialog
