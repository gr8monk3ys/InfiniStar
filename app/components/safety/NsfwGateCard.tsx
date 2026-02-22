"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

export function NsfwGateCard() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenGate = () => {
    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }
    setDialogOpen(true)
  }

  const handleConfirm = async () => {
    if (!ageConfirmed) return
    setIsLoading(true)
    const loader = createLoadingToast("Enabling NSFW content...")
    try {
      await api.patch(
        "/api/safety/preferences",
        { isAdult: true, nsfwEnabled: true },
        { retries: 0, showErrorToast: false }
      )
      loader.success("NSFW content enabled")
      setDialogOpen(false)
      router.refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to enable NSFW content"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setDialogOpen(false)
    setAgeConfirmed(false)
  }

  return (
    <>
      <Button onClick={handleOpenGate} aria-haspopup="dialog">
        Enable 18+ NSFW
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Age Verification Required</DialogTitle>
            <DialogDescription>
              This content is for adults only. By proceeding you confirm you are 18 or older and
              agree to our{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Content Policy
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 py-2">
            <input
              type="checkbox"
              id="age-confirm"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <label htmlFor="age-confirm" className="cursor-pointer text-sm text-foreground">
              I confirm that I am <strong>18 years of age or older</strong> and understand this
              content may include adult themes.
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!ageConfirmed || isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? "Enabling..." : "Confirm & Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
